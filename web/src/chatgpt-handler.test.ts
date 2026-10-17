import { afterEach, expect, it } from 'vitest';
import { createServer, request as httpRequest, type Server } from 'node:http';
import { readFileSync } from 'node:fs';
import { createChatGPTHandler } from '../chatgpt-handler';
import type { LocalChatGPT } from '../chatgpt-auth';
import type { Bank } from './types';
import { prepareReview } from './examiner';
import { reviewFixture, testEssay } from '../test-fixtures/examiner';
const bank = JSON.parse(readFileSync(new URL('../public/content/bank.json', import.meta.url), 'utf8')) as Bank;
const servers: Server[] = []; const stops: (() => void)[] = [];
afterEach(async () => { stops.splice(0).forEach(stop => stop()); await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve())))); });
async function serve(hosted = false) {
  const calls: unknown[] = [];
  const client = { cancel() {}, state: async () => ({ available: true, connected: true, sharing: true, connecting: false, activeId: 'test', accounts: [] }), models: async () => [{ slug: 'test-model', name: 'Test model' }], response: async (_model: string, _instructions: string, input: { content: { type: string; text?: string }[] }[]) => {
    calls.push(input);
    const data = JSON.parse(input[0].content[0].text!.split('\n').slice(1).join('\n'));
    const paper = bank.writing.find(p => p.title === data.paper)!;
    const prepared = prepareReview(bank, { skill: 'writing', testId: paper.id, model: 'test-model', language: 'id', answers: Object.fromEntries(paper.tasks.map(t => [t.id, data.tasks.find((task: { number: number }) => task.number === t.number).response])) });
    return JSON.stringify(reviewFixture(prepared));
  } } as unknown as LocalChatGPT;
  const endpoint = createChatGPTHandler({ hosted, client, bank }); stops.push(endpoint.close);
  const server = createServer((req, res) => void endpoint.handler(req, res, () => { res.statusCode = 404; res.end(); })); servers.push(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('No port');
  return { url: 'http://127.0.0.1:' + address.port, calls };
}
it('refuses cross-origin and forged-host requests before touching account access', async () => {
  const { url } = await serve();
  expect((await fetch(url + '/api/chatgpt/state')).status).toBe(403);
  expect((await fetch(url + '/api/chatgpt/state', { headers: { 'X-IELTS-Local': '1', Origin: 'https://unrelated.example' } })).status).toBe(403);
  const forged = await new Promise<number>(resolve => { const request = httpRequest(url + '/api/chatgpt/state', { headers: { 'X-IELTS-Local': '1', Host: 'unrelated.example' } }, response => { response.resume(); resolve(response.statusCode!); }); request.end(); });
  expect(forged).toBe(403);
  expect((await fetch(url + '/api/chatgpt/state', { headers: { 'X-IELTS-Local': '1' } })).status).toBe(200);
});
it('keeps subscription credentials unavailable on hosted deployments', async () => {
  const { url, calls } = await serve(true);
  expect((await fetch(url + '/api/chatgpt/state', { headers: { 'X-IELTS-Local': '1' } })).status).toBe(503);
  expect(calls).toHaveLength(0);
});
it('attaches the real Task 1 image and validates completed reviews before returning a weighted estimate', async () => {
  const { url, calls } = await serve(); const paper = bank.writing[0];
  const response = await fetch(url + '/api/chatgpt/review', { method: 'POST', headers: { 'X-IELTS-Local': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ skill: 'writing', testId: paper.id, model: 'test-model', language: 'id', answers: Object.fromEntries(paper.tasks.map(t => [t.id, testEssay])) }) });
  expect(response.status).toBe(200); expect((await response.json()).review.estimatedBand).toBe(7.5);
  expect(JSON.stringify(calls)).toContain('data:image/jpeg;base64,');
});
