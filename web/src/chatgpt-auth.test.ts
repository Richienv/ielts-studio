import { afterEach, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { LocalChatGPT, checkIdentity } from '../chatgpt-auth';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
const directories: string[] = []; const clients: LocalChatGPT[] = [];
afterEach(async () => { clients.splice(0).forEach(client => client.cancel()); await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
async function clientFixture(options: { expiry?: number; refreshVerificationFailure?: boolean; refreshWithoutIdentity?: boolean; stream?: string } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'ielts-auth-test-')); directories.push(directory);
  let authUrl: URL; let tokens = 0; let failRefresh = options.refreshVerificationFailure; let rejectExchange = false; let issuedClientId = 'oaiapp_test';
  const requests: { url: string; body?: string }[] = [];
  const client = new LocalChatGPT({ directory, fetch: async (url, init) => {
    const address = String(url); requests.push({ url: address, body: typeof init?.body === 'string' ? init.body : init?.body instanceof URLSearchParams ? init.body.toString() : undefined });
    if (address.endsWith('/oauth/token')) {
      tokens++; const data = new URLSearchParams(init?.body as URLSearchParams);
      if (data.get('grant_type') === 'authorization_code') expect(createHash('sha256').update(data.get('code_verifier')!).digest('base64url')).toBe(authUrl.searchParams.get('code_challenge'));
      if (rejectExchange) { rejectExchange = false; return Response.json({ error: 'invalid_grant' }, { status: 400 }); }
      return Response.json({ access_token: 'synthetic-access-' + tokens, refresh_token: 'synthetic-refresh-' + tokens, ...(!options.refreshWithoutIdentity || tokens === 1 ? { id_token: tokens === 1 ? 'synthetic-identity' : 'synthetic-renewed-identity' } : {}), token_type: 'Bearer', expires_in: tokens === 1 ? options.expiry ?? 3600 : 3600, scope: 'openid email resource.invoke chatgpt.tokens.use.direct' });
    }
    if (address.endsWith('/models')) return Response.json({ models: [{ slug: 'test-model', display_name: 'Test model', visibility: 'list' }] });
    if (address.endsWith('/responses')) return new Response(options.stream ?? 'data: {"type":"response.output_text.delta","delta":"Completed review"}\n\ndata: {"type":"response.completed","response":{"status":"completed"}}\n\n', { headers: { 'Content-Type': 'text/event-stream' } });
    throw new Error('Unexpected test request');
  }, verify: async (token, clientId, nonce) => {
    expect(clientId).toBe(issuedClientId);
    if (token === 'synthetic-renewed-identity' && failRefresh) { failRefresh = false; throw new Error('Temporary identity verification outage'); }
    return { sub: 'synthetic-subject', email: 'candidate@example.test', ...(nonce ? { nonce } : {}) };
  } }); clients.push(client);
  const login = async (newAccount = false, clientId = 'oaiapp_test', returnTo?: string) => { issuedClientId = clientId; authUrl = new URL(await client.signIn(newAccount, returnTo)); const callback = new URL(authUrl.searchParams.get('redirect_uri')!); callback.search = new URLSearchParams({ state: authUrl.searchParams.get('state')!, client_id: clientId, code: 'synthetic-code-' + tokens }).toString(); return { authUrl, callback }; };
  return { client, directory, requests, login, rejectNextExchange: () => { rejectExchange = true; }, tokenCount: () => tokens };
}
it('uses dynamic registration, persistent host identity and state/PKCE before exposing a safe account', async () => {
  const f = await clientFixture(); const { authUrl, callback } = await f.login();
  expect(authUrl.searchParams.get('client_id')).toBe('dynamic_agent_client');
  expect(authUrl.searchParams.get('agent_name_hint')).toBe('IELTS Studio');
  expect(authUrl.searchParams.get('scope')).toContain('chatgpt.tokens.use.direct');
  const invalid = new URL(callback); invalid.searchParams.set('state', 'not-the-state');
  expect((await fetch(invalid)).status).toBe(400); expect(f.tokenCount()).toBe(0);
  expect((await fetch(callback)).status).toBe(200);
  const state = await f.client.state(); expect(state).toMatchObject({ connected: true, sharing: true, email: 'candidate@example.test' });
  expect(JSON.stringify(state)).not.toContain('synthetic-access');
  expect((await stat(join(f.directory, 'chatgpt-auth.json'))).mode & 0o777).toBe(0o600);
  const returned = new URL(await f.client.signIn());
  expect(returned.searchParams.get('client_id')).toBe('oaiapp_test');
  expect(returned.searchParams.get('ext_agent_host_id')).toBe(authUrl.searchParams.get('ext_agent_host_id'));
  expect(returned.searchParams.get('state')).not.toBe(authUrl.searchParams.get('state'));
});
it('serialises rotating refreshes and recovers a persisted successor after verification fails', async () => {
  const f = await clientFixture({ expiry: 1, refreshVerificationFailure: true }); const { callback } = await f.login(); await fetch(callback);
  await expect(f.client.models()).rejects.toThrow('Temporary identity');
  expect(JSON.parse(await readFile(join(f.directory, 'chatgpt-auth.json'), 'utf8')).accounts[0].pendingRefresh).toBeTruthy();
  const result = await Promise.all([f.client.models(), f.client.models()]);
  expect(result[0][0].slug).toBe('test-model'); expect(f.tokenCount()).toBe(2);
});
it('recovers the failed new registration rather than retrying the previous active account', async () => {
  const f = await clientFixture(); const original = await f.login(); await fetch(original.callback);
  const originalId = (await f.client.state()).activeId;
  f.rejectNextExchange();
  const rejected = await f.login(true, 'oaiapp_second', 'http://127.0.0.1:4173/#chatgpt-examiner');
  const failure = await fetch(rejected.callback, { redirect: 'manual' });
  expect(failure.status).toBe(303);
  expect(failure.headers.get('Location')).toBe('http://127.0.0.1:4173/#chatgpt-examiner');
  expect(failure.headers.get('Referrer-Policy')).toBe('no-referrer');
  const state = await f.client.state();
  expect(state).toMatchObject({ activeId: originalId, connected: true, retryAccountLabel: 'Connection 2' });
  expect(state.retryAccountId).not.toBe(originalId);
  expect(state.error).toContain('invalid_grant');
  const saved = JSON.parse(await readFile(join(f.directory, 'chatgpt-auth.json'), 'utf8'));
  expect(saved.retryId).toBe(state.retryAccountId);
  const retry = await f.login(false, 'oaiapp_second');
  expect(retry.authUrl.searchParams.get('client_id')).toBe('oaiapp_second');
  expect(retry.authUrl.searchParams.get('state')).not.toBe(rejected.authUrl.searchParams.get('state'));
  expect(retry.authUrl.searchParams.get('code_challenge')).not.toBe(rejected.authUrl.searchParams.get('code_challenge'));
  expect(retry.authUrl.searchParams.get('agent_name_hint')).toBeNull();
  await fetch(retry.callback);
  expect((await f.client.state()).activeId).toBe(state.retryAccountId);
  expect((await f.client.state()).retryAccountId).toBeUndefined();
});
it('rejects an external callback return destination before starting OAuth', async () => {
  const f = await clientFixture();
  await expect(f.client.signIn(false, 'https://unrelated.example')).rejects.toThrow('local IELTS Studio');
  expect((await f.client.state()).connecting).toBe(false);
});
it('checks identity and nonce, and requires terminal completion rather than partial streamed text', async () => {
  expect(() => checkIdentity({ sub: 'other', nonce: 'nonce' }, 'expected', 'nonce')).toThrow('does not match');
  expect(() => checkIdentity({ sub: 'same', nonce: 'other' }, 'same', 'expected')).toThrow('could not be verified');
  const f = await clientFixture({ stream: 'data: {"type":"response.output_text.delta","delta":"Unfinished grade"}\n\ndata: [DONE]\n\n' });
  const { callback } = await f.login(); await fetch(callback);
  await expect(f.client.response('test-model', 'Review', [{ role: 'user', content: 'text' }], AbortSignal.timeout(10000))).rejects.toThrow('before completion');
  const posted = f.requests.find(request => request.url.endsWith('/responses'))!;
  expect(JSON.parse(posted.body!)).toMatchObject({ store: false, stream: true });
});
it('accepts a rotating refresh without a new ID token while keeping the verified account identity', async () => {
  const f = await clientFixture({ expiry: 1, refreshWithoutIdentity: true }); const { callback } = await f.login(); await fetch(callback);
  await expect(f.client.models()).resolves.toHaveLength(1);
  expect(f.tokenCount()).toBe(2);
  expect(await f.client.state()).toMatchObject({ connected: true, sharing: true, email: 'candidate@example.test' });
});
it('verifies real JWT signatures, issuer, audience, expiry and nonce against the discovered JWKS', async () => {
  const trusted = await generateKeyPair('RS256'); const other = await generateKeyPair('RS256');
  const publicKey = { ...await exportJWK(trusted.publicKey), kid: 'synthetic-key', use: 'sig', alg: 'RS256' };
  for (const scenario of ['valid', 'signature', 'issuer', 'audience', 'expiry', 'missing-expiry', 'nonce']) {
    const directory = await mkdtemp(join(tmpdir(), 'ielts-jwt-test-')); directories.push(directory);
    let nonce = '';
    const client = new LocalChatGPT({ directory, fetch: async url => {
      const address = String(url);
      if (address.endsWith('/.well-known/openid-configuration')) return Response.json({ issuer: 'https://auth.openai.com', jwks_uri: 'https://auth.openai.com/synthetic-jwks' });
      if (address.endsWith('/synthetic-jwks')) return Response.json({ keys: [publicKey] });
      if (address.endsWith('/oauth/token')) {
        const token = new SignJWT({ nonce: scenario === 'nonce' ? 'wrong-nonce' : nonce }).setProtectedHeader({ alg: 'RS256', kid: 'synthetic-key' }).setSubject('synthetic-subject').setIssuer(scenario === 'issuer' ? 'https://other.example' : 'https://auth.openai.com').setAudience(scenario === 'audience' ? 'another-client' : 'oaiapp_test').setIssuedAt();
        if (scenario !== 'missing-expiry') token.setExpirationTime(scenario === 'expiry' ? Math.floor(Date.now() / 1000) - 120 : '5m');
        const identity = await token.sign(scenario === 'signature' ? other.privateKey : trusted.privateKey);
        return Response.json({ access_token: 'synthetic-access', id_token: identity, expires_in: 3600, scope: 'openid chatgpt.tokens.use.direct', token_type: 'Bearer' });
      }
      throw new Error('Unexpected JWT test request');
    } }); clients.push(client);
    const login = new URL(await client.signIn()); nonce = login.searchParams.get('nonce')!;
    const callback = new URL(login.searchParams.get('redirect_uri')!); callback.search = new URLSearchParams({ state: login.searchParams.get('state')!, client_id: 'oaiapp_test', code: 'synthetic-code' }).toString();
    const response = await fetch(callback);
    expect(response.status, scenario).toBe(scenario === 'valid' ? 200 : 400);
    expect((await client.state()).connected, scenario).toBe(scenario === 'valid');
  }
});
