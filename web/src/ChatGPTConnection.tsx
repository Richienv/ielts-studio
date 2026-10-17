import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { CheckCircle2, ExternalLink, LogIn, LogOut, RefreshCw, ShieldCheck, UserPlus } from 'lucide-react';
import type { ChatGPTState, ChatGPTModel } from '../chatgpt-auth';
import { readLocal, writeLocal } from './storage';
import Band9Playbook from './Band9Playbook';
const local = () => ['127.0.0.1', 'localhost'].includes(location.hostname) && location.protocol === 'http:';
export async function chatGPTRequest<T>(action: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch('/api/chatgpt/' + action, { method: body === undefined ? 'GET' : 'POST', headers: { 'X-IELTS-Local': '1', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal });
  let value: Record<string, unknown>;
  try { value = await response.json() as Record<string, unknown>; } catch { throw new Error('ChatGPT connection is available in the local edition. Open IELTS Studio on this computer.'); }
  if (!response.ok) throw new Error(typeof value.error === 'string' ? value.error : 'The ChatGPT request could not complete.');
  return value as T;
}
interface Connection {
  state: ChatGPTState; models: ChatGPTModel[]; model: string; setModel: (model: string) => void;
  error: string; loading: boolean; working: boolean; authUrl: string;
  refresh: () => Promise<void>; signIn: (newAccount?: boolean) => Promise<void>;
  select: (id: string) => Promise<void>; disconnect: () => Promise<void>; cancel: () => Promise<void>;
}
const Context = createContext<Connection | null>(null);
export function ChatGPTProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ChatGPTState>({ available: local(), connecting: false, connected: false, sharing: false, accounts: [] });
  const [models, setModels] = useState<ChatGPTModel[]>([]); const [model, changeModel] = useState(() => readLocal('chatgpt-model', ''));
  const [error, setError] = useState(''); const [loading, setLoading] = useState(local()); const [working, setWorking] = useState(false); const [authUrl, setAuthUrl] = useState('');
  const [modelsRevision, setModelsRevision] = useState(0);
  const refresh = useCallback(async () => {
    if (!local()) return;
    try { const result = await chatGPTRequest<ChatGPTState>('state'); setState(result); if (!result.connecting) setAuthUrl(''); if (result.sharing) setModelsRevision(value => value + 1); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not check the ChatGPT connection.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); const focus = () => void refresh(); window.addEventListener('focus', focus); return () => window.removeEventListener('focus', focus); }, [refresh]);
  useEffect(() => { if (!state.connecting) return; const timer = setInterval(() => void refresh(), 2000); return () => clearInterval(timer); }, [state.connecting, refresh]);
  useEffect(() => {
    if (!state.sharing) { setModels([]); return; }
    let active = true; const controller = new AbortController();
    void chatGPTRequest<{ models: ChatGPTModel[] }>('models', undefined, controller.signal).then(result => { if (!active) return; setModels(result.models); changeModel(previous => result.models.some(m => m.slug === previous) ? previous : result.models[0]?.slug ?? ''); }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Could not load account models.'); });
    return () => { active = false; controller.abort(); };
  }, [state.sharing, state.activeId, modelsRevision]);
  const setModel = (value: string) => { changeModel(value); try { writeLocal('chatgpt-model', value); } catch { /* selection still works for this tab */ } };
  async function action(work: () => Promise<void>) { setWorking(true); setError(''); try { await work(); } catch (e) { setError(e instanceof Error ? e.message : 'The connection could not complete.'); } finally { setWorking(false); await refresh(); } }
  async function signIn(newAccount = false) {
    const popup = window.open('about:blank', '_blank');
    if (popup) { popup.opener = null; popup.document.title = 'Continue with ChatGPT'; popup.document.body.textContent = 'Preparing your ChatGPT sign-in…'; }
    await action(async () => {
      try {
        const result = await chatGPTRequest<{ url: string }>('login', { newAccount });
        const url = new URL(result.url); if (url.origin !== 'https://auth.openai.com') throw new Error('Unexpected sign-in destination.');
        setAuthUrl(result.url); if (popup) popup.location.replace(result.url);
      } catch (e) { popup?.close(); throw e; }
    });
  }
  const select = (id: string) => action(async () => { await chatGPTRequest('select', { id }); });
  const disconnect = () => action(async () => { const result = await chatGPTRequest<{ warning?: string }>('logout', {}); if (result.warning) setError(result.warning); });
  const cancel = () => action(async () => { await chatGPTRequest('cancel', {}); });
  return <Context.Provider value={{ state, models, model, setModel, error, loading, working, authUrl, refresh, signIn, select, disconnect, cancel }}>{children}</Context.Provider>;
}
export function useChatGPT() { const value = useContext(Context); if (!value) throw new Error('ChatGPT connection provider is unavailable.'); return value; }
export function ChatGPTAccountControls({ compact = false }: { compact?: boolean }) {
  const connection = useChatGPT(); const { state, models, model, setModel, loading, working, authUrl } = connection;
  return <div className={compact ? 'examiner-account compact' : 'examiner-account'}>
    <span className="status-pill">{loading ? 'Checking connection…' : state.connecting ? 'Finish sign-in in your browser' : state.sharing ? <><CheckCircle2 size={13}/>Using your ChatGPT plan</> : state.connected ? 'Identity connected · plan permission needed' : 'ChatGPT not connected'}</span>
    {!state.available ? <p>Personal ChatGPT reviews require the <a href="https://github.com/Richienv/ielts-studio/blob/main/README-SIMULATOR.md#open-the-app" target="_blank" rel="noreferrer">local edition</a> and your own account. The online app includes practice, answer keys and the strategy playbook without login.</p> : <>
      {state.accounts.length > 0 && <label className="examiner-field">ChatGPT connection<select aria-label="ChatGPT connection" value={state.activeId ?? ''} disabled={working || state.connecting} onChange={e => void connection.select(e.target.value)}>{state.accounts.map(account => <option key={account.id} value={account.id}>{account.label}{account.email ? ' · ' + account.email : ''}{account.connected ? '' : ' · signed out'}</option>)}</select></label>}
      {state.sharing && <label className="examiner-field">Reviewer model<select aria-label="ChatGPT reviewer model" value={models.some(m => m.slug === model) ? model : ''} onChange={e => setModel(e.target.value)} disabled={!models.length || working}><option value="" disabled>{models.length ? 'Choose model' : 'Loading eligible models…'}</option>{models.map(m => <option value={m.slug} key={m.slug}>{m.name}</option>)}</select></label>}
      <div className="examiner-actions">
        {!state.connecting && (!state.sharing || !compact) && <button className="primary" disabled={working || loading} onClick={() => void connection.signIn()}><LogIn size={16}/>{state.retryAccountLabel ? 'Retry ' + state.retryAccountLabel : state.connected ? 'Reconnect ChatGPT' : 'Continue with ChatGPT'}</button>}
        {state.connecting && <button className="secondary" disabled={working} onClick={() => void connection.cancel()}>Cancel sign-in</button>}
        {!compact && <button className="secondary" disabled={working || loading} onClick={() => void connection.signIn(true)}><UserPlus size={16}/>{state.connecting ? 'Use another account' : 'Add account'}</button>}
        {state.connected && <a href="https://chatgpt.com/settings/usage" target="_blank" rel="noreferrer">Manage usage<ExternalLink size={13}/></a>}
        {state.connected && !compact && <button className="text-button" disabled={working} onClick={() => void connection.disconnect()}><LogOut size={15}/>Sign out</button>}
        {!compact && <button className="text-button" disabled={working || loading} onClick={() => void connection.refresh()}><RefreshCw size={14}/>Refresh connection</button>}
      </div>
      {state.connecting && authUrl && <p className="muted">If the sign-in tab did not open, <a href={authUrl} target="_blank" rel="noreferrer">continue securely on OpenAI</a>. Return here after granting access.</p>}
      {!state.connecting && state.retryAccountLabel && <p className="muted">Retry will resume {state.retryAccountLabel} with a fresh sign-in code. It will not create another registration or replace your active account until verification succeeds.</p>}
      {state.connected && !state.sharing && <p className="error-text">Allow IELTS Studio to use your ChatGPT plan in ChatGPT Settings, then reconnect. Signing in alone does not grant model usage.</p>}
      {!state.sharing && !compact && <p className="muted">If OpenAI shows “A required permission is unavailable”, this account or workspace cannot grant plan usage. Choose “Add account” or “Use another account” to try a different eligible account/workspace. IELTS Studio cannot enable that permission.</p>}
    </>}
    {(connection.error || state.error) && <p role="alert" className="error-text">{connection.error || state.error}</p>}
  </div>;
}
export default function ChatGPTConnectionPage() {
  const available = useChatGPT().state.available;
  return <div className="examiner-connection-page"><div className="page-intro"><div><p className="date-line">Feedback after your session</p><h1>See your answers through an examiner’s eyes.</h1><p>{available ? 'Connect ChatGPT once. Get detailed reviews right here after each practice paper.' : 'Learn the strategies here. Connect your own ChatGPT plan in the local edition for personal reviews.'}</p></div><span className="academic-badge"><ShieldCheck size={16}/>{available ? 'Local connection' : 'Online practice'}</span></div>
    <section className="examiner-connect-card"><div><span className="status-pill">Your subscription · your account</span><h2>{available ? 'Connect your ChatGPT plan.' : 'Personal reviews in the local edition.'}</h2><p>{available ? 'Continue with ChatGPT, allow this app to use your plan, then return here. No API key is needed. Reviews count toward your ChatGPT plan’s shared allowance.' : 'The shared website includes timed practice, answer review and strategy guides. To have ChatGPT analyse your own responses, run the local edition from GitHub and connect your own eligible account.'}</p><p>In the local edition, sign-in credentials stay in protected files on your computer. IELTS Studio sends submitted answers and the relevant test material to OpenAI only when you request a review.</p></div><ChatGPTAccountControls/></section>
    <Band9Playbook/>
    <div className="examiner-feature-grid"><section><h3>Writing, criterion by criterion.</h3><p>Separate Task 1 and Task 2 estimates, actual sentence revisions, an improved paragraph, and a framework chosen for your response. The Task 1 diagram accompanies the review.</p></section><section><h3>Understand the trap.</h3><p>Reading and Listening reviews explain the decisive evidence, why another answer looks tempting, and the qualifier, correction or assumption that changes the answer.</p></section><section><h3>A specific next step.</h3><p>See recurring patterns, short drills, and a clear way to check improvement. Feedback defaults to Bahasa Indonesia, with English examples.</p></section></div>
    <section className="examiner-how"><h2>After you finish a session</h2><ol><li>Open the completed paper in My results.</li><li>Select “Review with ChatGPT” under Writing, Reading or Listening.</li><li>Read the evidence, revisions and priorities. Reviews are saved in this browser and can be downloaded.</li></ol><p>These are AI practice estimates, not official examiner scores. The app never changes objective marks or promises Band 9 from a template. Recorded Speaking responses still need an audio-capable reviewer; this ChatGPT connection does not assess pronunciation.</p></section>
    <p className="content-notice">Personal ChatGPT plan access is available in the local edition. Each person uses their own account; the shared website does not use the creator’s allowance. <a href="https://developers.openai.com/siwc/token-sharing-open-source" target="_blank" rel="noreferrer">About ChatGPT plan usage</a></p>
  </div>;
}
