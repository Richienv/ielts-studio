# IELTS Studio

A browser-based IELTS Academic simulator for personal exam preparation, extending the MIT-licensed IELTS Mastery Hub. Reuse its published Academic question bank, recorded listening MP3 files, writing figures, and grading approach. Preserve the upstream desktop app and license.

## Product

Three complete mock combinations, individual skill practice, a strict exam mode and a pausable practice mode. Listening plays all four parts once, with reading/checking intervals and a final two-minute review. Reading has three passages and 40 questions in 60 minutes. Writing shares 60 minutes across two tasks; Task 2 carries twice the weight. Speaking follows a recorded 12–14 minute scripted interview with a one-minute preparation and two-minute long turn. This cannot reproduce adaptive follow-up from a human examiner; label it clearly.

Use wall-clock deadlines, autosave after every answer, auto-submit expired sections, restore after reload, and keep full mock papers in Listening → Reading → Writing order without breaks. Speaking follows at the candidate's discretion, as a separate test. Exact answers and answers review for Listening and Reading; estimated practice bands clearly labelled. Writing and Speaking retain essays/audio for review and export; do not fabricate bands without assessment.

No account or API key required. Browser localStorage stores exam state/history, IndexedDB stores microphone recordings. Make exports available. Errors must remain recoverable and avoid losing drafts. Microphone permission is requested only when starting Speaking or the microphone check.

## Visual direction

A quiet study workspace, not a marketing landing page. Forest green #183f38, paper white #ffffff, cool canvas #f3f6f5, ink #243b36, muted sage #6e837c, lime #e6efb7. System sans for navigation; Georgia for a single large editorial title and reading passages. A fixed narrow sidebar, generous workspace, one dominant full-mock panel, and a compact test library. Exam view deliberately switches to plain white, restrained blue, large question numbers, a visible clock, independent reading/question panes and a bottom question navigator. No decorative photography, gradients, fake scores or fake activity.

## Implementation calls

React/TypeScript/Vite in web/, an isolated package so the Rust desktop runtime is optional. Python exports existing SQL seeds to structured browser JSON and copies licensed audio/images; validation reports malformed question banks. Full original content remains upstream. No cloud publication is requested. Serve at http://127.0.0.1:4173 and open inside Codex. Tests must exercise scoring, deadline math, data integrity and real browser workflows, including persistence and submission.
