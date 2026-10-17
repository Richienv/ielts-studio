# IELTS Studio — Academic simulator

A local browser-based extension of [IELTS Mastery Hub](https://github.com/open-lingua/ielts-mastery-hub). The original desktop application is preserved. The new application lives in `web/` and reuses the upstream MIT-licensed question banks, diagrams, and recorded Listening audio.

## Open the app

Shared web app: [IELTS Studio](https://ielts-studio-teal.vercel.app/). Timed practice, answer keys and the Reading/Listening/Writing strategy playbook work online without login. Personal ChatGPT subscription reviews require the local edition below; the hosted app does not access the creator's account or quota.

On this Mac, double-click **Open IELTS Studio.command**. Alternatively:

```sh
cd web
npm install
npm run dev
```

Open http://127.0.0.1:4173. Node 22.12 or newer is recommended. The server binds to loopback only. No account, payment, API key, Rust toolchain or desktop compilation is needed for practice.

## What works

- Three full mock combinations, with Listening → Reading → Writing in order and no breaks. Speaking is a separate interview, available from the completed mock or skill practice.
- Ten Academic Reading papers, three Listening papers with four local audio recordings each, and six Writing sets with actual Task 1 figures.
- Listening: question preview and checking periods, one pass through each recording in exam mode, then exactly two minutes to check all answers. Approximate test duration varies with the source recordings, as it does in the real format.
- Reading: 40 questions, a single 60-minute clock, independent passage/question scrolling, selection highlighting, notes, flags and direct question navigation.
- Writing: Tasks 1 and 2 share one 60-minute clock, saved drafts, live word counts and disabled spellcheck. Copying external text into answers is blocked in exam mode.
- Speaking: a 12-minute-15-second scripted interview, 60-second cue-card preparation and 120-second long turn, spoken British English prompts, actual microphone recording, periodic on-device recording saves, playback and individual clip download.
- Exam mode: continuous wall-clock deadlines, automatic submission, restoration after reload, no candidate-controlled pause or audio replay. Closing the tab does not stop an exam. Missed sections retain their original scheduled deadlines.
- Practice mode: pause/resume and Listening part replay.
- Deterministic Listening/Reading answer checks, correct-answer review, review filters, full Listening transcripts after submission, estimated practice bands, session history, JSON exports, essay downloads and downloadable voice clips.
- Responsive workspace, larger test text and increased contrast options.

## Strategy playbook and Band 9 practice

The ChatGPT examiner page includes a no-login playbook, also shown after completed Reading, Listening and Writing papers. It covers every question type in the current bank: claim/evidence decisions, headings, matching, multiple choice and completion, plus Task 1 visual reporting and Task 2 argument development. Each guide includes a reusable framework, a specific trap, an original worked example, a drill and an observable success check. Per-question review cards link to the corresponding strategy. Worked examples are labelled as invented teaching material and are not presented as evidence from the current paper.

The guidance links to official IELTS, British Council and IDP resources. Framework names are original learning aids, not official scoring formulas. Writing Band 9 goals follow the public criteria: complete task coverage, effortless organisation, lexical precision and exceptional control. Reading/Listening strategies support correct answers; they do not create additional strategy marks.

## ChatGPT examiner reviews (local edition)

Open **ChatGPT examiner** in the sidebar. Choose **Continue with ChatGPT**, sign in on OpenAI, allow ChatGPT plan usage, then return to IELTS Studio. Each person connects their own account and allowance. No OpenAI API key or separate API billing is used by this route. Account and model selection, adding accounts, sign-out, and a Manage usage link are available. Hosted deployments do not expose this local credential service.

After completing a paper, open **My results** and choose **Review with ChatGPT**. Reviews default to Bahasa Indonesia, with English examples; English feedback is also available. Submitted answers and canonical source material go to the selected account only when a review is requested.

- Writing: both essays and the actual Task 1 diagram accompany the request. Reviews cover all four criteria separately, examiner reasoning, exact candidate-sentence revisions, one teaching paragraph per task, a response-specific framework, and targeted drills. Every criterion also requires an observed gap from Band 9, a concrete change to the submitted response, and a self-check for the rewrite. Task 2 has twice the aggregate weight of Task 1. Missing criteria or an empty task prevent a complete overall estimate.
- Reading and Listening: review all answers by default, or focus on mistakes, blanks and flagged answers, in batches of eight. Each review explains decisive evidence, tempting distractors, the specific trap, an applied question-type framework, a high-accuracy habit, a drill and a measurable self-check. Decisive words are highlighted only when matched within verified evidence; unverified focus phrases are omitted. Quotes are checked against the passage/transcript. Disputed or unverified practice keys are flagged; deterministic marks remain unchanged.
- Reviews persist in this browser and can be downloaded. They are AI practice estimates, not official examiner assessments. No framework guarantees Band 9. Listening reviews use the transcript, not acoustic analysis. The ChatGPT connection does not send Speaking recordings or assess pronunciation; the original scripted Speaking recorder remains separate.

The OAuth implementation uses PKCE, state and nonce checks, signed ID-token validation against OpenAI JWKS, per-account dynamic client registrations and a stable installation host ID. Credentials are stored outside the repository in `~/.config/ielts-studio/chatgpt-auth.json`, using owner-only directory/file permissions, atomic replacement and serialized rotating-token refresh. Interrupted identity verification preserves a refresh successor for recovery. Browser state never receives access or refresh tokens. Requests require an exact loopback Host, same Origin when present, and a custom header; hosted execution is disabled. Successful inference requires a terminal response.completed event, not partial streamed text.

An unsuccessful code exchange retains the exact failed registration as a retry target, even if another account was active. Retry generates fresh state, nonce and PKCE with that issued client ID; it does not reuse the rejected code or replace the active account before validation. App-initiated callbacks return to the exact local examiner page with a 303 redirect and no authorization parameters in the destination URL.

Automated tests use synthetic credentials and explicitly mocked reviews. They establish OAuth/state/storage boundaries, canonical context, scoring aggregation, evidence checks and the UI flow.

Live verification on 17 October 2026 completed OAuth with ChatGPT plan usage granted, loaded the account's eligible models, and completed real Reading and Writing reviews with GPT-6.1-Sol. The Reading test used two deliberately incorrect synthetic answers; all returned evidence quotes matched the canonical passage. The Writing test sent two synthetic essays and the actual Task 1 figure. Its completed, validated review identified a deliberately reversed generator process, assessed all four criteria separately, preserved exact candidate quotations for revisions, proposed task-specific frameworks, and supplied targeted drills. A further real Listening review validated the expanded coaching schema: exact evidence, verified deciding words, an applied framework, a high-accuracy habit and measurable drills for two synthetic wrong answers. These checks establish working integration, not official examiner calibration or a real candidate band score.

For troubleshooting, compare the exact email reported by each session: a paid Codex account and a saved browser account can be different identities even when the addresses look similar. If OpenAI reports “A required permission is unavailable”, the selected account/workspace cannot currently grant plan usage. Use Add account to choose the correct eligible identity. An invalid_grant code-exchange failure requests a fresh sign-in with the retained registration; rejected codes are never reused. Local sign-in attempts allow 30 minutes for authentication and consent before expiring.

[Official ChatGPT plan usage documentation](https://developers.openai.com/siwc/token-sharing-open-source) · [Writing assessment](https://ielts.org/take-a-test/your-results/ielts-scoring-in-detail)

## Optional AI assessment

Copy `web/.env.example` to `web/.env.local`, set `GEMINI_API_KEY`, and restart the server. `GEMINI_MODEL` is configurable. The default model was selected from Google's current audio and structured-output documentation. Voice assessment also uses `ffmpeg` on the local server to convert browser recordings into supported MP3 audio. The key stays server-side and is never sent to the browser.

The Results page offers an explicit consent checkbox before sending essays or voice recordings to Gemini. The local endpoint accepts only Writing/Speaking, limits request size, validates the returned four-criterion assessment and displays provider failures without fabricating a band. Writing prompts explain the double weighting of Task 2. Speaking assessment uses the actual recorded audio, not a typed substitute.

No key is configured by this project. The live paid/provider assessment was **not** tested; the missing-configuration and validation paths are covered. Model availability and billing depend on the configured Gemini account. For Vercel, deploy this repository with `web` as the root directory. The `api/` functions serve evaluator status and assessment. `ffmpeg-static` bundles the Linux audio converter during cloud installation; local development can fall back to an installed `ffmpeg`. Configure `GEMINI_API_KEY` as a server environment variable only when you want AI grading enabled. Core practice requires no API key. Hosting only the static `dist/` folder omits the evaluator endpoints.

## Data and privacy

The app uses browser localStorage for current answers, results, notes and preferences, and IndexedDB for microphone recordings. Results and recordings are tied to the exact browser profile and origin. **Export before clearing browser data or changing the browser/profile/address.** Voice clips are saved at one-second intervals, including during an unfinished interview. No response is uploaded until the candidate explicitly requests an AI assessment.

In a full mock, finish a section to move on immediately; you cannot change that section's answers afterwards. Starting a replacement session asks you to acknowledge removal of unfinished answers. Submitted attempts remain in history. Practice needs no login; ChatGPT sign-in is optional for examiner reviews. There is no cloud sync.

## Content quality and exam fidelity

This is an independent practice tool. Source papers are AI-authored, not official IELTS examination material, and their difficulty labels are not validated band predictors. A fresh full mock combines existing papers; repeating practice may reuse questions. Reading passage lengths vary and some source papers are shorter than official papers. For a calibrated measure, use official practice material or an official test.

The simulated Speaking examiner follows a fixed script and cannot adapt follow-up questions like a human examiner. Examiner audio is synthesised using the macOS Daniel voice; Listening audio is reused from the upstream project. These are meaningful limits to realism, exposed in the UI where relevant.

Listening and Reading bands are **indicative estimates**. Actual IELTS raw-score boundaries can vary by paper. Writing and Speaking receive no band unless assessed; the app never manufactures an overall band from incomplete scores.

The export script repairs nine upstream table headers that were incorrectly numbered as scored questions, normalises nested table answers/options/accepted alternatives, and fixes two impossible word-limit instructions. Repairs are recorded in `web/public/content/validation.json`. Richer matching, headings, summary and table structures are normalised before rendering. The original SQL files remain untouched.

## Verification and maintenance

```sh
cd web
npm run build
npm test
npm run test:e2e
npm audit
```

The current suite includes 36 unit/integration checks and 14 browser scenarios, including all three review skills, complete strategy coverage of the actual bank, evidence/focus verification, and the no-login playbook. Browser tests cover answer persistence, flags, navigation, pause/resume, strict submission, results/export, full-mock sequencing after closure, Writing draft recovery, actual Listening playback/resume, actual browser microphone capture with a synthetic input device, saved-clip review and mobile overflow. Synthetic microphone tests verify the recording pipeline, not the physical microphone's sound quality.

Rebuild content from upstream SQL seeds:

```sh
python3 scripts/export-browser-content.py
```

Rebuild examiner audio on macOS with `ffmpeg` available:

```sh
python3 scripts/generate-examiner-audio.py
```

## References and attribution

- [Upstream repository and MIT license](https://github.com/open-lingua/ielts-mastery-hub)
- [IELTS Academic test format](https://ielts.org/take-a-test/test-types/ielts-academic-test)
- [Listening format](https://ielts.org/take-a-test/test-types/ielts-academic-test/ielts-academic-format-listening)
- [Reading format](https://ielts.org/take-a-test/test-types/ielts-academic-test/ielts-academic-format-reading)
- [Speaking format](https://ielts.org/take-a-test/test-types/ielts-academic-test/ielts-academic-format-speaking)
- [Google Gemini audio input](https://ai.google.dev/gemini-api/docs/audio)
- [Google Gemini structured outputs](https://ai.google.dev/gemini-api/docs/structured-output)

The original Open Lingua copyright and [MIT license](LICENSE) are retained. The browser extension and its original Speaking script are supplied under the same license.
