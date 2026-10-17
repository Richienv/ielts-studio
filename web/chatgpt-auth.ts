import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { chmod, lstat, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createRemoteJWKSet, customFetch, jwtVerify, type JWTPayload } from 'jose';

const ISSUER = 'https://auth.openai.com';
const RESOURCE = 'https://api.openai.com/v1';
const SCOPE = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';
const SHARING = 'chatgpt.tokens.use.direct';
interface Credentials { accessToken: string; refreshToken?: string; expiresAt: number; idToken?: string; scope: string[] }
interface Account { id: string; clientId: string; label: string; subject?: string; email?: string; name?: string; credentials?: Credentials; pendingRefresh?: { tokens: TokenResponse; receivedAt: number } }
interface Saved { version: 1; hostId: string; activeId?: string; retryId?: string; accounts: Account[] }
interface TokenResponse { access_token: string; refresh_token?: string; id_token?: string; expires_in: number; scope?: string; token_type?: string }
export interface ChatGPTAccount { id: string; label: string; email?: string; connected: boolean }
export interface ChatGPTState { available: boolean; connecting: boolean; connected: boolean; sharing: boolean; activeId?: string; email?: string; accounts: ChatGPTAccount[]; retryAccountId?: string; retryAccountLabel?: string; error?: string }
export interface ChatGPTModel { slug: string; name: string }
type Verify = (token: string, clientId: string, nonce?: string, receivedAt?: number) => Promise<JWTPayload>;
export class ChatGPTError extends Error { constructor(message: string, readonly status = 400, readonly code?: string) { super(message); } }
export function checkIdentity(claims: JWTPayload, expectedSubject?: string, nonce?: string) {
  if (typeof claims.sub !== 'string' || !claims.sub || (expectedSubject && claims.sub !== expectedSubject)) throw new ChatGPTError('The returned account does not match this connection. Sign in again.');
  if (nonce !== undefined && claims.nonce !== nonce) throw new ChatGPTError('The sign-in could not be verified. Start a fresh sign-in.');
}
function credentials(tokens: TokenResponse, receivedAt: number, previous?: Credentials): Credentials {
  if (!tokens || typeof tokens.access_token !== 'string' || !tokens.access_token || !Number.isFinite(tokens.expires_in) || tokens.expires_in <= 0 || (tokens.token_type && tokens.token_type.toLowerCase() !== 'bearer')) throw new ChatGPTError('OpenAI returned incomplete credentials. Sign in again.');
  return { accessToken: tokens.access_token, refreshToken: tokens.refresh_token ?? previous?.refreshToken, idToken: tokens.id_token ?? previous?.idToken, expiresAt: receivedAt + tokens.expires_in * 1000, scope: typeof tokens.scope === 'string' ? tokens.scope.split(/\s+/) : previous?.scope ?? [] };
}
export class LocalChatGPT {
  private file: string;
  private queue: Promise<unknown> = Promise.resolve();
  private pending?: { server: Server; timer: ReturnType<typeof setTimeout> };
  private epoch = 0;
  private error?: string;
  private discovery?: { jwks_uri: string; revocation_endpoint?: string };
  private keys?: ReturnType<typeof createRemoteJWKSet>;
  private fetcher: typeof fetch;
  private verify: Verify;
  constructor(private options: { directory?: string; fetch?: typeof fetch; verify?: Verify } = {}) {
    this.file = join(options.directory ?? join(homedir(), '.config', 'ielts-studio'), 'chatgpt-auth.json');
    this.fetcher = options.fetch ?? fetch;
    this.verify = options.verify ?? (async (token, clientId, nonce, receivedAt) => {
      const metadata = await this.metadata();
      this.keys ??= createRemoteJWKSet(new URL(metadata.jwks_uri), { timeoutDuration: 10000, [customFetch]: (url, init) => this.fetcher(url, init) });
      const { payload } = await jwtVerify(token, this.keys, { issuer: ISSUER, audience: clientId, requiredClaims: ['iss', 'aud', 'sub', 'exp', 'iat'], currentDate: new Date(receivedAt ?? Date.now()), clockTolerance: 30 });
      checkIdentity(payload, undefined, nonce);
      return payload;
    });
  }
  private locked<T>(work: () => Promise<T>): Promise<T> {
    const result = this.queue.then(work);
    this.queue = result.catch(() => undefined);
    return result;
  }
  private async read(): Promise<Saved> {
    try {
      const stat = await lstat(this.file);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Unsafe credential path');
      await chmod(this.file, 0o600);
      const saved = JSON.parse(await readFile(this.file, 'utf8')) as Saved;
      if (saved.version !== 1 || !Array.isArray(saved.accounts) || typeof saved.hostId !== 'string') throw new Error('Invalid store');
      return saved;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
        const saved: Saved = { version: 1, hostId: 'urn:uuid:' + randomUUID(), accounts: [] };
        await this.save(saved); return saved;
      }
      throw new ChatGPTError('The local ChatGPT connection file could not be read. It has been preserved; do not overwrite it.', 500);
    }
  }
  private async save(saved: Saved) {
    const directory = this.options.directory ?? join(homedir(), '.config', 'ielts-studio');
    await mkdir(directory, { recursive: true, mode: 0o700 });
    if ((await lstat(directory)).isSymbolicLink()) throw new ChatGPTError('Use a real local directory for ChatGPT credentials.', 500);
    await chmod(directory, 0o700);
    const temporary = join(directory, '.auth-' + randomUUID());
    await writeFile(temporary, JSON.stringify(saved), { mode: 0o600, flag: 'wx' });
    await rename(temporary, this.file);
  }
  private async metadata() {
    if (!this.discovery) {
      const response = await this.fetcher(ISSUER + '/.well-known/openid-configuration', { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new ChatGPTError('OpenAI identity verification is unavailable. Try again shortly.', 502);
      const value = await response.json() as { issuer: string; jwks_uri: string; revocation_endpoint?: string };
      if (value.issuer !== ISSUER || new URL(value.jwks_uri).origin !== ISSUER || (value.revocation_endpoint && new URL(value.revocation_endpoint).origin !== ISSUER)) throw new ChatGPTError('OpenAI returned unexpected identity settings.', 502);
      this.discovery = value;
    }
    return this.discovery;
  }
  private async token(parameters: Record<string, string>): Promise<TokenResponse> {
    const response = await this.fetcher(ISSUER + '/api/accounts/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(parameters), signal: AbortSignal.timeout(20000) });
    if (!response.ok) {
      if (response.status === 400 || response.status === 401) {
        const detail = await response.json().catch(() => ({})) as { error?: string | { code?: string }; error_description?: string };
        const code = typeof detail.error === 'string' ? detail.error : detail.error?.code;
        const safeCode = typeof code === 'string' && /^[a-zA-Z0-9_.-]{1,80}$/.test(code) ? ' (' + code + ')' : '';
        if (code === 'invalid_grant' && parameters.grant_type === 'authorization_code') throw new ChatGPTError('OpenAI rejected this sign-in code (invalid_grant). Retry the saved connection to request a fresh code. Your existing connections have been kept.', 401, code);
        throw new ChatGPTError('OpenAI could not renew or complete this sign-in' + safeCode + '. Continue with ChatGPT again.', 401, safeCode ? code : undefined);
      }
      throw new ChatGPTError('OpenAI sign-in is temporarily unavailable. Your saved connection has been preserved.', 502);
    }
    return await response.json() as TokenResponse;
  }
  async state(): Promise<ChatGPTState> {
    return this.locked(async () => {
      const saved = await this.read(); const active = saved.accounts.find(a => a.id === saved.activeId); const retry = saved.accounts.find(a => a.id === saved.retryId);
      return { available: true, connecting: !!this.pending, connected: !!active?.credentials, sharing: !!active?.credentials?.scope.includes(SHARING), activeId: active?.id, email: active?.email, accounts: saved.accounts.map(a => ({ id: a.id, label: a.label, email: a.email, connected: !!a.credentials })), retryAccountId: retry?.id, retryAccountLabel: retry?.label, error: this.error };
    });
  }
  cancel() { this.epoch++; if (this.pending) { clearTimeout(this.pending.timer); this.pending.server.close(); this.pending = undefined; } }
  async signIn(newAccount = false, returnTo?: string): Promise<string> {
    if (returnTo && !/^http:\/\/(?:127\.0\.0\.1|localhost):[0-9]+\/#chatgpt-examiner$/.test(returnTo)) throw new ChatGPTError('Use the local IELTS Studio page to start sign-in.');
    this.cancel(); this.error = undefined;
    const epoch = this.epoch;
    const assertActive = () => { if (epoch !== this.epoch) throw new ChatGPTError('This sign-in was cancelled. Start a fresh sign-in.'); };
    const saved = await this.locked(async () => { const value = await this.read(); if (newAccount && value.retryId) { delete value.retryId; await this.save(value); } return value; });
    const selected = newAccount ? undefined : saved.accounts.find(a => a.id === (saved.retryId ?? saved.activeId));
    const account: Account = selected ? { ...selected } : { id: randomUUID(), clientId: '', label: 'Connection ' + (saved.accounts.length + 1) };
    const state = randomBytes(32).toString('base64url'); const nonce = randomBytes(32).toString('base64url'); const verifier = randomBytes(48).toString('base64url');
    let finished = false; let redirect = '';
    const server = createServer((req, res) => {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.setHeader('Referrer-Policy', 'no-referrer');
      const finish = (status: number, message: string) => { if (returnTo) { res.statusCode = 303; res.setHeader('Location', returnTo); res.end(); } else { res.statusCode = status; res.end(message); } };
      const callback = new URL(req.url ?? '/', redirect || 'http://127.0.0.1');
      if (req.method !== 'GET' || callback.pathname !== '/auth/callback') { res.statusCode = 404; res.end('Not found.'); return; }
      if (req.headers.host !== new URL(redirect).host || callback.searchParams.get('state') !== state || finished) { res.statusCode = 400; res.end('Invalid or expired sign-in. Return to IELTS Studio and try again.'); return; }
      finished = true;
      void (async () => {
        try {
          if (callback.searchParams.has('error')) throw new ChatGPTError('ChatGPT sign-in was cancelled or permission was declined.');
          const code = callback.searchParams.get('code'); const issued = callback.searchParams.get('client_id') ?? account.clientId;
          if (!code || !issued || issued === 'dynamic_agent_client' || !/^[a-zA-Z0-9_-]{1,256}$/.test(issued) || (account.clientId && issued !== account.clientId)) throw new ChatGPTError('OpenAI did not return the expected client registration. Start a fresh sign-in.');
          account.clientId = issued;
          // Keep the issued registration even if code exchange expires.
          await this.locked(async () => { assertActive(); const current = await this.read(); if (!current.accounts.some(a => a.id === account.id)) { current.accounts.push({ id: account.id, clientId: issued, label: account.label }); current.activeId ??= account.id; await this.save(current); } });
          const tokens = await this.token({ grant_type: 'authorization_code', client_id: issued, code, code_verifier: verifier, redirect_uri: redirect, resource: RESOURCE });
          if (!tokens.id_token) throw new ChatGPTError('OpenAI did not return a verifiable identity. Sign in again.');
          const identity = await this.verify(tokens.id_token, issued, nonce);
          assertActive();
          checkIdentity(identity, selected?.subject, nonce);
          account.subject = identity.sub;
          account.email = typeof identity.email === 'string' ? identity.email : undefined;
          account.name = typeof identity.name === 'string' ? identity.name : undefined;
          account.credentials = credentials(tokens, Date.now());
          delete account.pendingRefresh;
          await this.locked(async () => { assertActive(); const current = await this.read(); current.accounts = [...current.accounts.filter(a => a.id !== account.id), account]; current.activeId = account.id; delete current.retryId; await this.save(current); });
          finish(200, account.credentials.scope.includes(SHARING) ? 'ChatGPT connected. Return to the IELTS Studio tab. You can close this sign-in tab.' : 'Identity connected, but ChatGPT plan usage was not granted. Return to IELTS Studio and manage your app permissions in ChatGPT.');
        } catch (e) {
          const message = e instanceof ChatGPTError ? e.message : 'The sign-in could not be verified. Return to IELTS Studio and sign in again.';
          if (epoch === this.epoch) {
            this.error = message;
            if (account.clientId) await this.locked(async () => { if (epoch !== this.epoch) return; const current = await this.read(); if (current.accounts.some(a => a.id === account.id)) { current.retryId = account.id; await this.save(current); } }).catch(() => undefined);
          }
          finish(400, message);
        } finally { if (this.pending?.server === server) this.cancel(); else server.close(); }
      })();
    });
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const address = server.address(); if (!address || typeof address === 'string') throw new ChatGPTError('Could not start the local sign-in callback.');
    redirect = 'http://127.0.0.1:' + address.port + '/auth/callback';
    const timer = setTimeout(() => { this.error = 'Sign-in expired. Continue with ChatGPT again.'; if (this.pending?.server === server) this.cancel(); }, 1800000);
    timer.unref(); this.pending = { server, timer };
    const url = new URL(ISSUER + '/api/accounts/authorize');
    const parameters: Record<string, string> = { client_id: account.clientId || 'dynamic_agent_client', ext_agent_host_id: saved.hostId, response_type: 'code', redirect_uri: redirect, scope: SCOPE, resource: RESOURCE, state, nonce, code_challenge_method: 'S256', code_challenge: createHash('sha256').update(verifier).digest('base64url') };
    if (!account.clientId) parameters.agent_name_hint = 'IELTS Studio';
    if (account.credentials?.idToken) parameters.id_token_hint = account.credentials.idToken;
    if (account.email) parameters.login_hint = account.email;
    url.search = new URLSearchParams(parameters).toString(); return url.toString();
  }
  async select(id: string) {
    this.cancel(); this.error = undefined;
    await this.locked(async () => { const saved = await this.read(); if (!saved.accounts.some(a => a.id === id)) throw new ChatGPTError('Choose a saved ChatGPT connection.'); saved.activeId = id; delete saved.retryId; await this.save(saved); });
  }
  async disconnect(): Promise<{ warning?: string }> {
    this.cancel();
    return this.locked(async () => {
      const saved = await this.read(); const active = saved.accounts.find(a => a.id === saved.activeId); let warning: string | undefined;
      if (active?.credentials?.refreshToken) {
        try {
          const metadata = await this.metadata();
          if (!metadata.revocation_endpoint) throw new Error('No revocation endpoint');
          let confirmed = false;
          for (let attempt = 0; attempt < 2; attempt++) {
            const response = await this.fetcher(metadata.revocation_endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: active.credentials.refreshToken, token_type_hint: 'refresh_token', client_id: active.clientId }), signal: AbortSignal.timeout(10000) });
            if (response.ok) { confirmed = true; break; }
            if (response.status < 500) break;
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          if (!confirmed) throw new Error('Revocation unconfirmed');
        } catch { warning = 'Signed out locally. Remote revocation was not confirmed; disconnect IELTS Studio in ChatGPT Settings to revoke its access.'; }
      }
      delete saved.retryId;
      if (active) { delete active.credentials; delete active.pendingRefresh; } await this.save(saved);
      this.error = undefined; return { warning };
    });
  }
  private async access(): Promise<string> {
    return this.locked(async () => {
      const saved = await this.read(); const active = saved.accounts.find(a => a.id === saved.activeId);
      if (!active?.credentials) throw new ChatGPTError('Continue with ChatGPT to connect your plan first.', 401);
      if (active.pendingRefresh || active.credentials.expiresAt < Date.now() + 60000) {
        if (!active.pendingRefresh) {
          if (!active.credentials.refreshToken) throw new ChatGPTError('This connection has expired. Continue with ChatGPT again.', 401);
          const tokens = await this.token({ grant_type: 'refresh_token', client_id: active.clientId, refresh_token: active.credentials.refreshToken, resource: RESOURCE });
          // Persist a rotating successor before verification so a transient JWKS outage cannot lose it.
          active.pendingRefresh = { tokens, receivedAt: Date.now() }; await this.save(saved);
        }
        const rotation = active.pendingRefresh;
        if (rotation.tokens.id_token !== undefined) {
          if (typeof rotation.tokens.id_token !== 'string' || !rotation.tokens.id_token) throw new ChatGPTError('The refreshed identity could not be verified. Reconnect ChatGPT.', 401);
          const identity = await this.verify(rotation.tokens.id_token, active.clientId, undefined, rotation.receivedAt);
          checkIdentity(identity, active.subject);
        }
        active.credentials = credentials(rotation.tokens, rotation.receivedAt, active.credentials); delete active.pendingRefresh; await this.save(saved);
      }
      if (!active.credentials.scope.includes(SHARING)) throw new ChatGPTError('Sign-in succeeded, but ChatGPT plan usage is not enabled. Manage this connection in ChatGPT Settings.', 403);
      if (active.credentials.expiresAt <= Date.now()) throw new ChatGPTError('The connection was recovered. Try the request again to renew it.', 401);
      return active.credentials.accessToken;
    });
  }
  async models(): Promise<ChatGPTModel[]> {
    const token = await this.access(); const response = await this.fetcher(RESOURCE + '/models', { headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new ChatGPTError('Could not load models for this account. Reconnect or try again shortly.', response.status === 401 ? 401 : 502);
    const data = await response.json() as { models?: { slug: string; display_name: string; visibility: string }[] };
    const models = data.models?.filter(m => m.visibility === 'list' && typeof m.slug === 'string').map(m => ({ slug: m.slug, name: m.display_name || m.slug })) ?? [];
    if (!models.length) throw new ChatGPTError('No eligible models were returned for this connection.', 403);
    return models;
  }
  async response(model: string, instructions: string, input: unknown[], signal: AbortSignal): Promise<string> {
    const token = await this.access();
    const response = await this.fetcher(RESOURCE + '/responses', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, instructions, input, stream: true, store: false }), signal });
    if (!response.ok || !response.body) throw new ChatGPTError(response.status === 429 ? 'Your ChatGPT usage limit was reached. Manage usage in ChatGPT or try later.' : 'ChatGPT could not complete this review (' + response.status + '). Check model access or reconnect; your answers are saved.', response.status === 429 ? 429 : 502);
    const reader = response.body.getReader(); const decoder = new TextDecoder(); let pending = ''; let text = ''; let completed = false;
    const consume = (frame: string) => {
      const data = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
      if (!data || data === '[DONE]') return;
      const event = JSON.parse(data) as { type: string; delta?: string; response?: { status?: string; output?: { type: string; content?: { type: string; text?: string }[] }[] } };
      if (event.type === 'response.output_text.delta') text += event.delta ?? '';
      if (event.type === 'response.failed' || event.type === 'response.incomplete' || event.type === 'error') throw new ChatGPTError('ChatGPT did not complete the review. Your plan may have reached a limit; check ChatGPT Settings → Usage and try again.', 502);
      if (event.type === 'response.completed' && event.response?.status === 'completed') {
        completed = true;
        const full = event.response.output?.flatMap(item => item.content ?? []).filter(item => item.type === 'output_text').map(item => item.text ?? '').join('');
        if (full) text = full;
      }
      if (text.length > 500000) throw new ChatGPTError('The review exceeded the output limit. Review fewer answers at a time.', 502);
    };
    try {
      for (;;) { const next = await reader.read(); pending += decoder.decode(next.value, { stream: !next.done }).replace(/\r\n/g, '\n'); let end: number; while ((end = pending.indexOf('\n\n')) >= 0) { consume(pending.slice(0, end)); pending = pending.slice(end + 2); } if (next.done) break; if (pending.length > 1000000) throw new ChatGPTError('ChatGPT returned an oversized event.', 502); }
      if (pending.trim()) consume(pending);
      if (!completed || !text.trim()) throw new ChatGPTError('The review stream ended before completion. No partial score has been saved. Try again.', 502);
      return text;
    } finally { await reader.cancel().catch(() => undefined); }
  }
}
