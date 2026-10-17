# Verification — 17 October 2026

Production TypeScript/Vite build passed. Fourteen engine/content/audio tests passed. Eight end-to-end browser tests passed in local Chrome, including actual HTML audio playback and actual MediaRecorder capture with a synthetic microphone input. Dependency audit reported zero vulnerabilities.

Audio transcoding was additionally verified against ffmpeg/ffprobe to produce supported MP3 audio for the optional evaluator.

The final browser run covered persistence, flags, summary inputs, pausing, immutable submission/review, result download, full-mock deadlines across section boundaries, dual Writing drafts, once-only Listening playback and resume, saved microphone clip playback, mobile overflow, and the unconfigured AI endpoint.

Visual review performed for the desktop dashboard, Reading test, Writing test, and mobile overview. The finished app was opened in the Codex in-app browser.

No live Gemini key was provisioned and no provider call was made. The optional AI provider path is implemented but not integration-tested against a paid account. The physical microphone and headphones were not sampled; microphone verification used Chrome’s synthetic input device.

## Hosting preparation

Added Vercel Node API adapters, same-origin checks for the hosted domain, support for Vercel-parsed JSON bodies, bundled cloud audio conversion, and non-personal candidate defaults. Three additional HTTP tests cover deployed-origin handling, unavailable-grader messaging, and cross-origin rejection.
