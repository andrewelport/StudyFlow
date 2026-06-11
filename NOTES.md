# StudyFlow — session notes

## Repo snapshot (2026-05-28)

**Stack:** Plain HTML/CSS/JS PWA, RTL Hebrew, no build step. Tagline "StudyFlow — ה-Waze של הלימודים." Entry is `index.html` → loads `scheduler.js?v=33` + `app_v58.js?v=9` (note: `app.js` (6764 lines) exists alongside `app_v58.js` (7006 lines) and is **not loaded** — likely a stale older version). Styling is `style.css?v=129` + `style_v6.css?v=131`. PWA shell via `sw.js` (cache `studyflow-v146`, network-first for HTML/CSS/JS) + `manifest.json` (standalone, RTL/he). Backend is two serverless proxies that both hit Groq `llama-3.3-70b-versatile`: `api/groq-proxy.js` (Vercel, `vercel.json`) and `netlify/functions/groq-proxy.js` (Netlify, `netlify.toml`). Cloud sync + auth via Supabase (referenced from `app.js`; Google sign-in UI present in `index.html`). Deterministic time-blocking scheduler lives in `scheduler.js` (484 lines): wake/sleep windows, anchors (recurring commitments), focus-time preference, mandatory 15-min breaks, 20-min anchor buffers — pure JS, no AI. Onboarding is an 8-step slide flow with attribution, name, institution, theme preview.

**What works (visible in code):** Splash + onboarding flow, auth overlay (Google + email), Supabase persistence (`sf_free_v1` localStorage key for offline), deterministic scheduler with focus-time preferences, Groq proxy with graceful fallback (proxy first, then direct call), PWA install + offline caching, dual deploy targets (Netlify primary per DEPLOY.md, Vercel config also committed).

**What's stubbed / smelly:**
- Four empty junk files committed at repo root from a botched shell command: `S.tasks.push({...t`, `String(t.id)`, `sleep2)`, `sleepMin)`. Safe to delete.
- Two app.js versions (`app.js`, `app_v58.js`) — only `_v58` is wired up; `app.js` is dead weight.
- Two style sheets (`style.css`, `style_v5.css`, `style_v6.css`) — only `style.css` + `style_v6.css` are loaded; `style_v5.css` is dead.
- `_DEV_API_KEY = 'gsk_placeholder_...'` in app.js — placeholder, not a leaked key, but the direct-call-from-client fallback path (`_callGroqDirect`) is sketchy and should never run in production.
- Two `groq-proxy.js` copies (Vercel + Netlify) — both alive, fine for dual deploy but easy to drift.
- Nested `StudyFlow/api/groq-proxy.js` — leftover folder duplicate.
- All commits on `main` are `"Add files via upload"` — no real history, drag-and-drop deploy workflow.

**Gap to a winning 90-sec demo:** Don't know yet — depends on the feature list. The bones are solid (auth + scheduler + AI proxy + PWA shell). Likely demo wins: live AI re-planning when an exam shifts, conflict resolution between anchors, visual day/week view of the generated plan, "one-tap" recovery from a missed task. Risks: 7k-line single-file `app_v58.js` will be painful to navigate for new features; need to grep + read targeted sections rather than read top-to-bottom.

## Branch

Working on `adir/dev` (off `main`). `origin/Andrew` also exists.
