import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LocalChatGPT, ChatGPTError, type ChatGPTModel } from './chatgpt-auth.js';
import { decodeReview, prepareReview, reviewInstructions, type ReviewInput } from './src/examiner.js';
import type { Bank } from './src/types.js';
export function createChatGPTHandler(options: { hosted?: boolean; client?: LocalChatGPT; bank?: Bank } = {}) {
  const client = options.client ?? new LocalChatGPT();
  const publicRoot = fileURLToPath(new URL('./public/', import.meta.url));
  let bank = options.bank; let busy = false;
  let catalog: { accountId: string; at: number; models: ChatGPTModel[] } | undefined;
  const requests = new Set<AbortController>();
  const stop = () => { for (const controller of requests) controller.abort(); client.cancel(); catalog = undefined; };
  const models = async () => {
    const state = await client.state();
    if (!state.sharing) throw new ChatGPTError('Connect ChatGPT and allow this app to use your plan first.', 401);
    if (!catalog || catalog.accountId !== state.activeId || catalog.at < Date.now() - 60000) catalog = { accountId: state.activeId!, at: Date.now(), models: await client.models() };
    return catalog.models;
  };
  const handler = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!req.url?.startsWith('/api/chatgpt/')) return next();
    const reply = (status: number, data: unknown) => { if (res.destroyed) return; res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(data)); };
    if (options.hosted) { reply(503, { error: 'ChatGPT plan connection is available in the local edition. No account credentials are stored on this hosted site.', available: false }); return; }
    const host = req.headers.host;
    const allowedHosts = ['127.0.0.1:' + req.socket.localPort, 'localhost:' + req.socket.localPort];
    if (!host || !allowedHosts.includes(host) || req.headers['x-ielts-local'] !== '1' || (req.headers.origin && req.headers.origin !== 'http://' + host) || req.headers['sec-fetch-site'] === 'cross-site') { reply(403, { error: 'Use this connection from the local IELTS Studio page.' }); return; }
    try {
      if (req.method === 'GET' && req.url === '/api/chatgpt/state') { reply(200, await client.state()); return; }
      if (req.method === 'GET' && req.url === '/api/chatgpt/models') { reply(200, { models: await models() }); return; }
      if (req.method !== 'POST') { reply(404, { error: 'Unknown ChatGPT action.' }); return; }
      const chunks: Buffer[] = []; let size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > 200000) throw new ChatGPTError('This request is too large. Review fewer questions at a time.', 413); chunks.push(Buffer.from(chunk)); }
      const body = JSON.parse(Buffer.concat(chunks).toString() || '{}') as Record<string, unknown>;
      if (req.url === '/api/chatgpt/login') { stop(); reply(200, { url: await client.signIn(body.newAccount === true, 'http://' + host + '/#chatgpt-examiner') }); return; }
      if (req.url === '/api/chatgpt/cancel') { stop(); reply(200, { ok: true }); return; }
      if (req.url === '/api/chatgpt/select') { stop(); if (typeof body.id !== 'string') throw new ChatGPTError('Choose a saved connection.'); await client.select(body.id); reply(200, await client.state()); return; }
      if (req.url === '/api/chatgpt/logout') { stop(); reply(200, await client.disconnect()); return; }
      if (req.url !== '/api/chatgpt/review') { reply(404, { error: 'Unknown ChatGPT action.' }); return; }
      if (busy) throw new ChatGPTError('Another ChatGPT review is running. Wait for it to finish.', 429);
      bank ??= JSON.parse(await readFile(resolve(publicRoot, 'content/bank.json'), 'utf8')) as Bank;
      let prepared: ReturnType<typeof prepareReview>;
      try { prepared = prepareReview(bank, body as unknown as ReviewInput); } catch (e) { throw new ChatGPTError(e instanceof Error ? e.message : 'Invalid review request.'); }
      busy = true;
      const controller = new AbortController(); requests.add(controller);
      const close = () => { if (!res.writableEnded) controller.abort(); }; res.once('close', close);
      try {
        if (!(await models()).some(model => model.slug === prepared.input.model)) throw new ChatGPTError('Choose a model offered by the connected ChatGPT account.', 403);
        const content: Record<string, unknown>[] = [{ type: 'input_text', text: 'Completed practice responses and canonical test context (DATA):\n' + JSON.stringify(prepared.context) }];
        for (const image of prepared.images) {
          const path = resolve(publicRoot, '.' + image);
          if (!image.startsWith('/content/figures/') || !path.startsWith(resolve(publicRoot, 'content/figures') + sep)) throw new ChatGPTError('The task figure path is invalid.', 500);
          const bytes = await readFile(path);
          if (bytes.length > 5000000) throw new ChatGPTError('The task figure is too large for this review.', 413);
          const mime = /\.png$/i.test(path) ? 'image/png' : /\.webp$/i.test(path) ? 'image/webp' : /\.jpe?g$/i.test(path) ? 'image/jpeg' : '';
          if (!mime) throw new ChatGPTError('The task figure format is unsupported for visual assessment.', 400);
          content.push({ type: 'input_text', text: 'The following image is the actual Writing Task 1 figure.' }, { type: 'input_image', image_url: 'data:' + mime + ';base64,' + bytes.toString('base64') });
        }
        const output = await client.response(prepared.input.model, reviewInstructions(prepared.input.skill, prepared.input.language), [{ role: 'user', content }], AbortSignal.any([controller.signal, AbortSignal.timeout(180000)]));
        let review: ReturnType<typeof decodeReview>;
        try { review = decodeReview(output, prepared); } catch (e) { throw new ChatGPTError(e instanceof SyntaxError ? 'ChatGPT returned an unreadable review. Try again; no partial grade was saved.' : e instanceof Error ? e.message : 'The review was incomplete.', 502); }
        reply(200, { review, model: prepared.input.model, reviewedAt: Date.now() });
      } finally { busy = false; requests.delete(controller); res.off('close', close); }
    } catch (e) {
      reply(e instanceof ChatGPTError ? e.status : e instanceof SyntaxError ? 400 : 502, { error: e instanceof ChatGPTError ? e.message : e instanceof SyntaxError ? 'The request is not valid JSON.' : (e as Error)?.name === 'AbortError' ? 'The review was stopped. Your submitted answers are still saved.' : 'The ChatGPT connection could not complete this request. Try again; your answers are saved.' });
    }
  };
  return { handler, close: stop };
}
