# IELTS Studio — Academic simulator

A local browser-based extension of [IELTS Mastery Hub](https://github.com/open-lingua/ielts-mastery-hub). The original desktop application is preserved. The new application lives in `web/` and reuses the upstream MIT-licensed question banks, diagrams, and recorded Listening audio.

## Open the app

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

## Optional AI assessment

Copy `web/.env.example` to `web/.env.local`, set `GEMINI_API_KEY`, and restart the server. `GEMINI_MODEL` is configurable. The default model was selected from Google's current audio and structured-output documentation. Voice assessment also uses `ffmpeg` on the local server to convert browser recordings into supported MP3 audio. The key stays server-side and is never sent to the browser.

The Results page offers an explicit consent checkbox before sending essays or voice recordings to Gemini. The local endpoint accepts only Writing/Speaking, limits request size, validates the returned four-criterion assessment and displays provider failures without fabricating a band. Writing prompts explain the double weighting of Task 2. Speaking assessment uses the actual recorded audio, not a typed substitute.

No key is configured by this project. The live paid/provider assessment was **not** tested; the missing-configuration and validation paths are covered. Model availability and billing depend on the configured Gemini account. For Vercel, deploy this repository with `web` as the root directory. The `api/` functions serve evaluator status and assessment. `ffmpeg-static` bundles the Linux audio converter during cloud installation; local development can fall back to an installed `ffmpeg`. Configure `GEMINI_API_KEY` as a server environment variable only when you want AI grading enabled. Core practice requires no API key. Hosting only the static `dist/` folder omits the evaluator endpoints.

## Data and privacy

The app uses browser localStorage for current answers, results, notes and preferences, and IndexedDB for microphone recordings. Results and recordings are tied to the exact browser profile and origin. **Export before clearing browser data or changing the browser/profile/address.** Voice clips are saved at one-second intervals, including during an unfinished interview. No response is uploaded until the candidate explicitly requests an AI assessment.

In a full mock, finish a section to move on immediately; you cannot change that section's answers afterwards. Starting a replacement session asks you to acknowledge removal of unfinished answers. Submitted attempts remain in history. There is no login or cloud sync.

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

Browser tests cover answer persistence, flags, navigation, pause/resume, strict submission, results/export, full-mock sequencing after closure, Writing draft recovery, actual Listening playback/resume, actual browser microphone capture with a synthetic input device, saved-clip review and mobile overflow. Synthetic microphone tests verify the recording pipeline, not the physical microphone's sound quality.

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
