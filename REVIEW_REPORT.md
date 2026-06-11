# StudyFlow — Consolidated Deep-Review Report

**Project:** StudyFlow PWA ("the Waze of studying") — RTL-Hebrew, plain HTML/CSS/JS, deterministic scheduler + Groq/Gemini LLM proxy, Supabase auth stub, offline `localStorage` (`sf_free_v1`).
**Context:** Hackathon demo. Items that can break the live 90-second demo are tagged **DEMO-RISK**.
**Active files reviewed:** `index.html`, `app_v58.js` (~6986 lines), `scheduler.js` (~440), `style.css`, `style_v6.css`, `sw.js`, `api/groq-proxy.js` + `netlify/functions/groq-proxy.js`, `manifest.json`.
**Source:** 166 verified findings, de-duplicated and merged. Cross-checked against `INVESTIGATION_REPORT.md` and `test/TEST_RESULTS.md` — items found there are marked **(known)**, everything else is **(new)**.

---

## 1. Executive Summary

StudyFlow is feature-rich and mostly works on the happy path, but the deep review surfaced a small cluster of defects that can visibly break the demo and a broader pattern of unescaped-`innerHTML` injection across every chat surface. The single most dangerous demo-breaker is `_rcConfirmAndClose()` calling an **undefined `_toast()`** (app_v58.js:4736): if a judge unchecks any task in the collision/recalc flow and hits "אישור והמשך," the overlay freezes and the console throws. Three scheduler-level bugs also undercut the core selling points: onboarding-entered class anchors are **silently discarded** (`finishOnboarding` throws away `collectAnchors()`), exams have **no time field** so the engine fakes an 08:00 exam and **deletes all exam-day study**, and **overnight sleep schedules** (sleep ≤ wake) produce an empty week. Security-wise the app is account-less so blast radius is limited, but the wide-open LLM proxy (wildcard CORS, no auth, no rate limit, no file-size cap) is a real post-demo abuse/quota-drain risk, and stored DOM-XSS via chat/ICS/task names is trivially exploitable. The good news: `escapeHtml` already exists, the proxy keeps the API key server-side (no shipped secret), and most fixes are one-to-three lines.

**Counts:** Critical 0 · High 7 · Medium 30 · Low 30 · Enhancements 9.

---

## 2. P0 — Demo-Breakers (fix before judging)

These can break or visibly degrade the live 90-second demo.

| # | Issue | File:Loc | One-line fix |
|---|-------|----------|--------------|
| P0-1 | **`_rcConfirmAndClose()` calls undefined `_toast()`** → ReferenceError; recalc overlay never closes when ≥1 task is unchecked. The collision/spread-recalc flow is a flagged top demo risk. **(new)** | app_v58.js:4736 | Rename `_toast` → `toast`; wrap body in `try/finally` so `closeRecalc()` always runs. |
| P0-2 | **Onboarding anchors silently dropped** — `finishOnboarding` calls `collectAnchors()` as a bare statement and discards its return; `S.anchors` stays empty, summary shows "0 עוגנים," scheduler can't avoid classes (the headline claim). **(new)** | app_v58.js:950-958 (collect 891-918; wrapper 7093-7118) | `const a = collectAnchors(); if (Array.isArray(a)&&a.length) S.anchors=(S.anchors||[]).concat(a);` before `save()`. (app.js:735 already does it right.) |
| P0-3 | **Exam-day study collapses to nothing** — exams are created with no `time`, scheduler defaults `examMin` to 08:00 and forbids study finishing after 08:00, so the exam day is left empty for that course (the most important study slot). **(new)** | scheduler.js:387-405; exam creation app_v58.js:2236/2564/2600/3090/4521 | Treat missing time as end-of-day (`examMin=null` → no restriction); add a time input to the exam UI. |
| P0-4 | **Overnight schedules (sleep ≤ wake) yield an empty week** — `_buildBlocked` only blocks `[sleep,1440]` when `sleep>wake`; night-owl profiles get `free=0` everywhere and `reason:'no_time'`. Students are a prime night-owl demographic. **(new)** | scheduler.js:33-36, 103-105, 145-151 | `const effSleep = sleep>wake ? sleep : 24*60;` and use `effSleep` in tail checks; validate at input. |
| P0-5 | **Stored/DOM XSS via chat + names rendered into `innerHTML`** — user input, LLM "rich HTML" replies, and AI/ICS-derived task/course names are inserted raw across Tutor, Oracle, Hobby coach, Recalc, and the next-task widget. A `<img onerror=…>` executes in-session and re-renders every load (persisted). Could deface the UI mid-demo. **(new)** | app_v58.js next-task 574-575; Tutor 6754/6762; Oracle 6692/6705; Hobby 5416/5437; Recalc 6514/6543; `escapeHtml` at L3 | Escape every untrusted interpolation with `escapeHtml(...)`; escape THEN apply `\n→<br>`. For "rich HTML" Oracle replies, prompt plain text or allowlist-sanitize. |
| P0-6 | **`callAI` 503 fallback misdirects troubleshooting** — when the Gemini proxy is down / `GEMINI_API_KEY` unset (a flagged demo risk), errors fall through to the dead direct path and report "enter a Groq API key" instead of "AI unavailable." **(new)** | app_v58.js:1083-1107 (`_callGroqDirect` 1045-1047) | Add `'503'`/`'אינן זמינות'`/offline to the re-throw whitelist so the real 503 message surfaces. |
| P0-7 | **Focus-lock back-guard self-disables after one back-press** (`{once:true}` listener not re-armed) — the second back/swipe exits focus mode without solving the challenge; the marquee 90-min closer looks broken. **(new)** | app_v58.js:6816-6817, 6820-6825, 6857 | Re-add the popstate listener inside `_flPopState` (or drop `{once:true}` and `removeEventListener` on close); clean up the pushed state. |
| P0-8 | **Focus-lock open path has unguarded DOM derefs** — `getElementById(...).textContent` on six `fl-*` ids; any markup drift throws mid-setup and half-renders the closer. **(new)** | app_v58.js:6795-6802, 6834, 6841, 6875-6878, 6887/6896-6902 | Optional-chain each lookup (a `setText` helper); the file already uses `?.` at 6831. |
| P0-9 | **AI plan generators return invalid JSON** — both `generatePlan` and `generateSemesterPlan` failed JSON validation in proxy tests (18s / 37s latency); if either is on the demo path the plan silently fails to parse. **(known — TEST_RESULTS #3, #4)** | proxy callers; app_v58.js:2087, 2822 | Harden JSON parse/repair on the client; pre-warm or avoid these slow callers in the live script; keep the deterministic scheduler as the demo path. |

> **Demo guidance:** Drive the plan through the deterministic scheduler (works end-to-end per INVESTIGATION_REPORT), avoid `generateSemesterPlan` (37s + invalid JSON), and pre-set a non-overnight wake/sleep + a real exam date before judging.

---

## 3. P1 — High-Impact Bugs / Security

| # | Issue | File:Loc | One-line fix |
|---|-------|----------|--------------|
| P1-1 | **Proxy fully open** — wildcard CORS, no auth, no rate limit, no file-size cap; anyone with the URL can drain the Gemini quota (→ every AI feature 503s) and run up cost via megabyte base64 `files`. **(new)** | api/groq-proxy.js:9,83-88; netlify/functions/groq-proxy.js:13/77; vercel.json:12 | Origin allowlist (echo deployed origin + localhost), shared-secret header or edge IP rate-limit, cap `messages` length + total `files` size (~4-6MB). |
| P1-2 | **One-time anchors treated as recurring** — `getAvailableSlots`, `isTimeInFreeWindow`, and the semester-plan filter omit the `oneTimeDate` guard used everywhere else, so a single appointment blocks **every** matching weekday and silently filters valid AI slots (can trigger "no valid slots"). **(new)** | app_v58.js:2050, 2100, 2958-2962 (guarded elsewhere: 2324/3080/3216/4675/5050/6494/7108) | Add the `oneTimeDate` guard to all three; factor one `isAnchorActiveOn(a,dateStr,dayIdx)` helper. |
| P1-3 | **Scheduler greedy front-loading** — placement walks days in order and `findBestFreeSlot` returns the earliest slot, so sessions stack at top-of-morning / front-of-week and later days stay empty. This is the "money shot" on `#page-schedule`. **(new)** | scheduler.js:96-127, 276-296, 364-428 | Sort eligible days by current load before placing; prefer a slot near the middle of the largest free region. |
| P1-4 | **Per-day caps silently drop quota; stats report "ok"** — `maxPerDay`/`maxSameDay`/consecutive-day skip can leave "maximum"-load sessions and even due-soon homework unplaced, with no shortfall surfaced. **(new)** | scheduler.js:281-282, 374-380, 430-458, 482-490 | Track requested vs placed; expose `stats.unplaced`; warn on un-placeable homework; relax caps in a final pass when free time remains. |
| P1-5 | **`confirmWeeklyPlan` deletes in-range tasks before the safety pass, no rollback** — if the anchor-overlap filter rejects all new tasks, the user ends with an *emptier* week than before, irreversibly. **(new)** | app_v58.js:6473-6508 | Build new list in a temp array, run safety filter on new tasks only, abort/restore if zero survive; snapshot for undo. |
| P1-6 | **Oracle drops the user turn on AI error** — on a `callAI` throw the user message is shown in the UI but never pushed to `assistantHistory`; UI and history desync accumulates and the model "forgets" visible questions; `slice(-24)` can cut mid-pair. **(new)** | app_v58.js:6684-6693, 6735 | Push the user turn before the await; build messages from updated history; on catch keep/pop consistently. |
| P1-7 | **`save()` QuotaExceeded handler only toasts** — no eviction, no retry; once quota is hit mid-session every save silently fails and a reload reverts everything. **(new)** | app_v58.js:466-474 | On quota error force `_pruneOldData`, drop oldest done/missed, retry `setItem` once; trim unbounded arrays. |
| P1-8 | **`generatePlan` reads `gen-btn` before null check** — `btn.disabled=true` (and reset) is unguarded; in semester/first-run DOM variants this throws synchronously before any AI call, outside the catch. **(new)** | app_v58.js:2151, 2248 (also 2904, 3057) | Guard `if (btn){…}`. |
| P1-9 | **No live secret leak (confirmation)** — proxies read `GEMINI_API_KEY` server-side only; `_DEV_API_KEY=''`; repo-wide key regex found nothing real (only the dead `app.js` placeholder). **(new — positive)** | api/groq-proxy.js:15-19; app_v58.js:1043 | No action; keep `_DEV_API_KEY` empty; confirm env var name on the live host. |

---

## 4. UI/UX Gaps & Enhancements (ranked by demo wow-factor)

1. **Onboarding tour doesn't navigate or cover hackathon features** — 8 center-modal text steps; never `showPage()`s, never highlights, and omits the schedule-upload/ICS/AI-assistant beats (the strongest demo moments). **(known — INVESTIGATION_REPORT #7)** → Add a `page` field per step + `showPage(s.page)`; add 3-5 steps for upload/ICS/assistant/focus-lock/emergency. *SMALL, ~30 min, high upside.*
2. **Emergency-mode discoverability** — the crunch CTA is buried on the exam dashboard. **(known — #6)** → Auto-banner the emergency CTA on `#page-today` when an exam is < 7 days away. *SMALL.*
3. **`scheduleExamCrunch` rarely places tasks** — it string-matches whole-hour labels (`'08:00'`…) against windowed free-text like `08:30–11:15`, so most days yield zero crunch slots ("לא נמצאו חריצים"). **(new)** → Reuse `_findSlotsInRange` instead of substring-matching hour labels. *Undermines a headline feature.*
4. **Calendar sub-hour resolution / zoom / week grid missing** — only hour labels render; a 14:15 task has no visual anchor; 64px/hr hardcoded; no 7-day grid. **(known — #5)** → Add half-hour gridlines + minute ticks (SMALL); zoom toggle (MEDIUM); week grid (LARGE).
5. **Calendar "now" line is broken at most hours** — `slotMins` has 8 academic boundaries vs 13 hourly labels; afternoon/evening rows get `undefined` and the red line vanishes or misplaces. **(new)** → Build `slotMins = hours.map(h=>toMins(h))` + trailing `21*60`. *Visible selling point of the timeline.*
6. **Native `confirm()` in emergency mode** — ugly browser dialog vs the app's styled modals. **(known — #6)** → Swap for a styled modal. *SMALL.*
7. **No feedback loop from manual edits** — moving a task in the timeline doesn't update `focus_time`; next generation repeats the rejected placement. **(known — #3)** → Track edited tasks, fold inferred preference back into `S.profile`. *MEDIUM, judges ask "what if I disagree?".*
8. **Pomodoro auto-completes the linked task on timer end** (no confirm) and uses a stale closed-over `taskId`, so changing the dropdown mid-session completes the wrong task. **(new)** → Prompt/partial-state instead of auto-done; re-read the dropdown at completion. → app_v58.js:1994-1997.
9. **Phantom hobby sessions** — `submitHobbyProgress` reuses stale `window._hpProgVal`, injecting fake done-tasks and inflating points/streak. **(new)** → Reset `window._hpProgVal=0` on modal open; `?.value`. → app_v58.js:5754-5772.
10. **Focus-lock math challenge polish** — subtraction can demand a negative answer; empty submit shows a nonsensical "יותר" hint. **(new)** → Order operands A≥B; short-circuit on `NaN`. → app_v58.js:6873, 6897.

---

## 5. Accessibility / Performance / PWA / Data-Integrity

### Data-integrity
- **`addPlanToSchedule` can delete pending/completed same-slot tasks; the "replaced N" toast uses a different predicate than the deletion** → app_v58.js:2310-2313 (semester 3064-3068). Compute the replaced set with the exact deletion predicate; decide whether same-course pending tasks should be replaced. **(new)**
- **`generateSemesterPlan` dedups by Hebrew prose date key** (`formatPrettyDate(...)__time`) → two distinct courses at the same slot collide, last-write-wins, a task vanishes. → app_v58.js:2965. Key on raw `t.date__t.time__t.course`. **(new)**
- **Homework: past-due / zero-duration items reserve quota but never place** → scheduler.js:243-246, 273-296. Filter `hw.date < firstDay` and `duration<=0` before quota *and* placement. **(new)**
- **Shared `hwLastPlacedDay` cursor across all homework** → assignments avoid each other's days arbitrarily, can miss due dates. → scheduler.js:272-296. Track per-homework. **(new)**
- **Largest-remainder not used in session split** → the *last* course in object-key order absorbs rounding and can be zeroed even when high-weight (near-exam). → scheduler.js:248-261. Use largest-remainder distribution. **(new)**
- **ICS-imported anchors store dead `travel:0` instead of `travelMin`** → schema drift. → app_v58.js:4253. Rename to `travelMin`. **(new)**
- **`_validateStreak` / streak math use local `ld()`** → DST/travel can double-count or skip a streak day. → app_v58.js:411-418. Anchor to `Asia/Jerusalem` like `_extractTasksFromICS` (1226). **(new)**
- **Oracle exam `daysLeft` & `_needsWeeklyReview` mix UTC-parsed `YYYY-MM-DD` with local now** → off-by-one for Israel. → app_v58.js:6645, 5698. Parse `+'T12:00'`. **(new)**
- **Recalc/Oracle anchor-collision hardcodes 90-min task length** → false collisions for shorter tasks, missed for longer. → app_v58.js:6703 (Oracle), 4406/4440 (add paths). Parse real duration as the edit path does (4373). **(new)**
- **Recalc spread/move actions hardcode 90-min slot width but keep each task's real duration** → 120-min tasks placed in 90-min-verified slots overlap. → app_v58.js:4664-4698. Pass actual duration into `_findSlotsInRange`. **(new)**
- **`hpConfirmAddTasks` places hobbies with no collision/anchor check** and `findHobbySlots` hardcodes 22:00 ignoring `sleepTime`. → app_v58.js:5459-5472, 5494. Route through `findBestFreeSlot`; clamp to `timeToMins(S.sleepTime)`. **(new)**
- **`confirmWeeklyPlan` no-rollback** (see P1-5).

### Performance
- **`renderNextTaskCountdown` calls `renderAll()` from inside its own 1s tick** at the task boundary → redundant full re-render every second; possible momentary double interval. → app_v58.js:545-585. Refresh only the widget at the boundary. **(new)**
- **`renderCalendarView` per-minute `setInterval` can throw/stack** — unguarded element read inside the callback; not cleared on page-leave. → app_v58.js:4164-4172. Null-guard; clear in `showPage()`. **(new)**
- **AI plan generators are slow** (18s / 37s) — keep off the live demo path. **(known — TEST_RESULTS).**

### PWA / Proxy
- **`sendHobbyPageMessage` returned HTTP 500 / `fetch failed` after 305s** in proxy tests — the hobby-coach message order produces an awkward `[empty-user, model, user]` translation. **(known — TEST_RESULTS #7 + quirk #2).** Reorder so the first content turn is `user`.
- **`sendRecalc` ruleReminder positional shift on multi-turn** — JSON-format reminder lands on the oldest user turn after proxy collapse; JSON adherence degrades past ~5 turns. **(known — TEST_RESULTS #1).** Re-inject the format rule fresh each call.
- **`checkAuth` is inert dead scaffolding** — mocked `getSession` always returns null; the cached-token recovery branch is unreachable; if ever wired before boot it would always block. → app_v58.js:107-116. Delete or document. **(new)**

### Accessibility / Robustness (unguarded DOM, defensive)
- Several handlers throw on a single missing/renamed id (inconsistent guarding): `toast()` (231), `updateHeaderStats` urgent-banner (537-541), `renderExams`/`renderExamDashboard` (4532, 4568), `addReminder`/`showAddAnchorModal`/`saveManualTask` (3918-3982, 4035), `plShAddHobby` focus (2455), `sendTutor` loading-node remove (6762), `_obBuildSummary` `S.anchors.length` (791). **(new)** → Add `if(!el) return;` / `?.` consistently with the file's own style.
- **`saveSettings` rejects overnight schedules via string compare** (`wake>=sleep`) — blocks night-shift students and is brittle to unpadded times. → app_v58.js:709, 737. Support overnight or message clearly; compare via `timeToMins()`. **(new)**

---

## 6. Code Cleanup (dead files & dead code)

**Delete these — `index.html` does not load them:**
- `app.js` — dead duplicate; contains the only literal API-key *placeholder* (`gsk_placeholder_…`). Deleting it removes the risk that a future reader pastes a real key there. (Ironically `app.js:735` has the *correct* `S.anchors = collectAnchors();` that the active file regressed — use it as the reference fix, then delete.)
- `style_v5.css` — superseded by `style.css` / `style_v6.css`.
- The nested `StudyFlow/api/` directory — duplicate proxy (Groq variant) with the same open-CORS posture; not deployed from here.
- The 4 junk files at repo root (per task brief).

**Dead/confusing in-code (active files):**
- `let _emergencyPlan = null;` (app_v58.js:213) — declared, never read. **(known — #6).**
- `window._semesterColorOverride = colorMap` render side-effect into unused `origGet` (app_v58.js:3000) — latent global leak. **(new)**
- `scheduleExamCrunch` `crunchNames=[ex.course]` (length 1) makes `nameIdx % length` always 0 — dead rotation logic (app_v58.js:4486, 4499-4500). **(new)**
- `_callGroqDirect` direct path is intentionally dead (empty key) yet reachable via the 503 fallback — see P0-6.
- **Scheduler header claims "100% Deterministic" but uses `Math.random()` task ids** (scheduler.js:1, 286, 324, 344, 417, 447) — false claim + collision risk corrupts task state. Use the app's `uid()` or a per-generation counter. **(new)**

---

## 7. Quick Wins (high impact / low effort)

- [ ] **P0-1** Rename `_toast` → `toast` at app_v58.js:4736 (+ `try/finally`). *One line, unfreezes the recalc demo.*
- [ ] **P0-2** Assign `collectAnchors()` result to `S.anchors` in `finishOnboarding` (app_v58.js:951). *Restores the "avoids your classes" claim.*
- [ ] **P0-6** Add `503`/`אינן זמינות`/offline to the `callAI` re-throw whitelist (app_v58.js:1104). *Correct error if the proxy is down.*
- [ ] **P0-7** Re-arm the focus-lock popstate listener (drop `{once:true}` + cleanup). *Fixes the focus closer.*
- [ ] **P1-1** Replace proxy `ACAO '*'` with an origin allowlist + base64 size cap. *Stops quota drain.*
- [ ] **P0-4** `effSleep = sleep>wake ? sleep : 24*60;` in scheduler tail checks. *Night-owl profiles get a plan.*
- [ ] Reset `window._hpProgVal=0` on hobby-progress modal open (app_v58.js). *Kills phantom sessions.*
- [ ] Escape user/LLM strings in the next-task widget + chat bubbles with the existing `escapeHtml` (P0-5). *Closes XSS, prevents stray-`<` markup breakage.*
- [ ] Delete `app.js`, `style_v5.css`, nested `StudyFlow/api/`, and the 4 root junk files. *Removes the only key placeholder + confusion.*
- [ ] Delete `_emergencyPlan` (app_v58.js:213) and the `window._semesterColorOverride` side-effect (3000). *Trivial.*

---

## 8. QA Test Checklist

Run before judging. Each line is a concrete pass/fail.

**Onboarding & data**
- [ ] Complete onboarding with 2+ class anchors → verify summary shows the correct anchor count (not "0 עוגנים") and the generated week avoids those times. *(P0-2)*
- [ ] Reload after onboarding → `S.anchors`, tasks, profile persist (`sf_free_v1`).
- [ ] Fill localStorage near quota, keep editing → confirm saves still persist or a real eviction+retry happens (not just a toast). *(P1-7)*

**Scheduler**
- [ ] Set a real exam date + time → exam-day study is scheduled before the exam, not deleted. *(P0-3)*
- [ ] Set wake 14:00 / sleep 02:00 (overnight) → a non-empty plan is produced. *(P0-4)*
- [ ] Add a one-time anchor next Tuesday → other Tuesdays remain bookable. *(P1-2)*
- [ ] Generate with "מקסימום" load → placed session count matches requested (no silent shortfall); week is spread, not front-loaded top-of-morning. *(P1-3, P1-4)*
- [ ] Re-plan a week, let safety pass reject new tasks → original tasks are NOT lost. *(P1-5)*

**Collision / recalc (top demo risk)**
- [ ] Open the recalc/spread flow, **uncheck at least one** suggested task, hit "אישור והמשך" → overlay closes, no console error. *(P0-1)*
- [ ] Add an anchor via Oracle that overlaps tasks of varied durations → only truly-overlapping tasks are flagged. *(short/long-duration collision)*

**AI / proxy**
- [ ] Trigger an AI feature with the proxy reachable → correct reply renders.
- [ ] Simulate proxy 503 / missing `GEMINI_API_KEY` → user sees "AI unavailable," not "enter a Groq key." *(P0-6)*
- [ ] Multi-turn Oracle chat with one forced error mid-conversation → context stays consistent, no "forgotten" visible question. *(P1-6)*
- [ ] Avoid `generateSemesterPlan` / `generatePlan` on the live path (37s, invalid JSON in tests); if used, verify JSON parses. *(P0-9)*

**Focus-lock / Pomodoro**
- [ ] Enter focus lock → all `fl-*` fields render (no half-render). *(P0-8)*
- [ ] Press back twice → second press is intercepted (challenge required to exit). *(P0-7)*
- [ ] Start a Pomodoro on task A, switch dropdown to B, let it finish → the *current* task is handled, not stale A; task isn't blindly marked done. *(Pomodoro bug)*

**Security / XSS**
- [ ] Enter a task/course/chat message containing `<img src=x onerror=alert(1)>` → it renders as text, does not execute, persists safely. *(P0-5)*
- [ ] Import an ICS with a `<script>`-style title → no execution in the next-task widget or preview. *(P0-5)*

**UI smoke**
- [ ] Calendar "now" line appears at the correct row/position across morning, afternoon, evening. *(now-line bug)*
- [ ] Emergency/crunch mode actually places sessions (not "לא נמצאו חריצים"). *(crunch parsing)*
- [ ] Run the onboarding tour as a fresh user → it reaches the schedule-upload moment. *(tour gap)*

---

*Report generated from 166 verified findings, de-duplicated and merged. "(known)" = previously documented in INVESTIGATION_REPORT.md or test/TEST_RESULTS.md; "(new)" = surfaced by this review.*
