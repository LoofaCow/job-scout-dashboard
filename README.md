# Job Scout Dashboard

The desktop front end for [Job Scout](https://github.com/LoofaCow/job-scout) —
a native app that shows me which jobs the scout surfaced, why it scored them
the way it did, and where each one stands.

The backend does the finding and scoring. This is the part I actually look at.

---

## What it does

Polls the Job Scout API every 30 seconds and renders whatever cleared the
scoring threshold. Each job shows its score, the skills the scorer matched, and
its written rationale — so when something scores a 78 I can see the reasoning
instead of trusting a number.

Job status (interested, applied, interviewing, rejected, offer) updates from the
card and writes straight back to the API, which means the desktop app and the
database never drift apart.

When a run surfaces something new, the app fires a native OS notification. That
part matters more than it sounds: the whole point of the project is that I stop
checking job boards, which only works if the thing that replaced them comes and
finds me.

---

## How it's built

**Tauri 2** for the shell, so it's a real desktop app rather than a browser tab
— native notifications, an OS window, and a small binary instead of a bundled
Chromium.

**SvelteKit with the static adapter.** No SSR; there's no server here, just a
frontend talking to localhost. Svelte 5 runes (`$state`) for reactivity.

**HTTP through Tauri's plugin rather than the webview's `fetch`.** Requests go
through the Rust shell's permission system, so what the frontend is allowed to
reach is declared in `src-tauri/capabilities/` instead of being wide open.

**`src/lib/api.ts` is a typed client that mirrors the backend's Pydantic
models.** `SurfacedJob`, `JobDetail`, `RunSummary`, `ApplicationStatus` — all
of it lines up field for field with `app/api.py` on the Python side. When the
backend's schema changes, TypeScript tells me what broke instead of the UI
quietly rendering `undefined`.

The API base is `http://127.0.0.1:8000`. Everything stays on the machine.

---

## Running it

You need the [Job Scout backend](https://github.com/LoofaCow/job-scout) running
first — this app is a window onto it and won't show anything without it.

```bash
npm install
npm run tauri dev      # native desktop app
```

Browser-only, if you just want to poke at the UI:

```bash
npm run dev
```

Build a release binary:

```bash
npm run tauri build
```

Type-check:

```bash
npm run check
```

---

## Where it's at

Working: surfaced job list with score-coded cards, expandable detail with the
scorer's rationale, status updates written back to the API, recent run history,
manual scout triggering, and native notifications on new matches.

Still to do:

- A mobile client against the same API, so I can triage from my phone.
- Filtering and sorting beyond the score threshold.
- Showing the tear_apart analysis (seniority, work arrangement, employment
  type) on the cards now that the backend produces it.

MIT licensed.
