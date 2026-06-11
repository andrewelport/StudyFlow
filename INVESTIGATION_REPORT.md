# StudyFlow — 5-Item Investigation Report

Read-only investigation. No code changed. Branch: `adir/dev` @ `381d560`.

---

## #3 — Schedule algorithm correctness

### Code location
- `scheduler.js:178` — `generateWeeklySchedule(answers)`, the deterministic generator
- Called from one place: `_wrGenerate()` at `app_v58.js:5864` (the weekly-review flow only)
- Inputs read: `S.profile.focus_span`, `S.profile.focus_time`, `S.profile.style`, `S.profile.exam_fear`, `S.courses`, `S.exams`, `S.anchors`, `S.hobbies`, plus per-call `answers.{courseDifficulty, load, selectedHobbies, homework, startDate, endDate}`
- Two unrelated AI planners also exist: `generatePlan` at `app_v58.js:2087`, `generateSemesterPlan` at `:2822` — they hit Gemini directly and don't share state with the deterministic one

### What exists today
The deterministic scheduler is **end-to-end functional and respects all listed inputs**: free-pool calc → study quota by `load` percentage → per-course weight (multiplied 1.4–2.5× by exam proximity) → 4-phase placement (homework → hobbies → courses with peak-time preference → fallback) → anchor-collision safety pass. It honors `focus_time` for hard-course peak scheduling and `focus_span` to derive session length. The `style` profile prefix-tweaks task names ("תרגול ומטלות:", "סיכום וקריאה:"). The exam-day branch refuses to schedule a session that doesn't finish before the exam starts (lines 380–399). Two AI planners exist separately but never combine with the deterministic algorithm — no hybrid layer.

### What's missing / broken
**No feedback loop from user edits back into the algorithm.** If the user manually moves "Math" from 09:00 to 19:00 in the timeline, `S.profile.focus_time` doesn't update — next `generateWeeklySchedule` run will still try morning placement. The weekly-review answers DO feed forward (course difficulty + load), but per-task edits are invisible to future generations. There's also no AI layer wrapping/post-processing the deterministic output — you have either deterministic OR AI, not both.

### Fix size
**MEDIUM** for a useful feedback loop (track edited tasks, infer revised preference, fold back into `S.profile.focus_time` / per-course preference map). **LARGE** for a proper AI-on-top layer that takes the deterministic result and refines it.

### Demo risk if we DON'T fix
**MEDIUM** — judges asking "what happens if I disagree with the plan?" get "you edit and that's it" instead of "the AI/algorithm learns and adapts."

### Breakage risk if we DO fix now
**HIGH** — `generateWeeklySchedule` is 305 lines of interlocking quota/weight/placement logic; touching the input shape or any phase can silently degrade output quality. The "AI on top" path is lower-risk if it strictly post-processes (re-rank, swap times) without rewriting the planner.

---

## #4 — Hobby time allocation

### Code location
- **Automatic path:** `scheduler.js:299-355` — "Phase D.2: Hobby Placement" inside `generateWeeklySchedule`. Runs whenever the user finishes the weekly review.
- **Button path:** `findHobbySlots()` at `app_v58.js:5443`, wired to the "מצא לי זמן בלוז שלי ל{label}" button at `index.html:1174`.

### What exists today
Hobbies are allocated **both automatically and manually**. The automatic path treats hobbies as second-priority commitments (after homework, before courses), prefers the 14:00–22:00 window, enforces a 1-day gap between sessions of the same hobby (with a second pass that relaxes the gap if not enough room), and respects the hobby's `timesPerWeek` (capped at 5/week). The button path is standalone: it scans the next 7 days, calls `findBestFreeSlot` per day with the same 14:00–22:00 preference, builds candidate slots up to `timesPerWeek`, and shows a per-slot checkbox modal — user picks which to keep, clicks approve, tasks are added with `course = hobby.name`.

### What's missing / broken
Nothing functionally broken. Two minor smells: (a) the button path lives entirely separate from `generateWeeklySchedule` — it doesn't share the algorithm's exam-day exclusions or anchor-collision safety pass (it does check `findBestFreeSlot` which respects anchors, so it's mostly fine); (b) the button label was the "ספורט/אימונים" bug we already fixed in commit `381d560`.

### Fix size
**N/A** — works as designed.

### Demo risk if we DON'T fix
**NONE** — demos cleanly via either path.

### Breakage risk if we DO fix now
**N/A** — no fix needed.

---

## #5 — Calendar visual design (zoom-to-day, minute resolution)

### Code location
- `app_v58.js:3132` — `_renderScheduleTimeline(sow, eow)`, the weekly view shell + date strip
- `app_v58.js:3169` — `renderDayTimeline(dateStr)`, the actual hour-grid + event painter (the "day view")
- Layout constants at `app_v58.js:3165-3166`: `TL_HOUR_PX = 64`, `TL_PX_MIN = 64/60`, `TL_START_H = 7`, `TL_END_H = 23`
- Today-page timeline reuses `today-tasks-wrap` rendered by `renderTodayTasks()` at `app_v58.js:3268` — different, smaller "agenda list" style

### What exists today
The day-view timeline is a **single column from 07:00 to 23:00, 64px per hour (~1.067px per minute)**. Events are positioned by `top = (startMins - 7*60) * TL_PX_MIN` and sized by `height = durMins * TL_PX_MIN`. **Minute-level positioning already works** — a task at 14:15 with a 75-min duration renders correctly to the pixel, including overlap-column splitting (events that collide share width via `_col` / `_totalCols`). A red "now line" sweeps across when viewing today. The "weekly view" is a horizontal date strip at the top that selects which day to render below — there is no Google-Calendar-style 7-column week grid.

### What's missing / broken
**No visual cues for sub-hour resolution.** Only hour labels render; the comments at lines 3237-3238 explicitly removed half-hour gridlines and minor ticks. So a 14:15 task lands ~16px below the 14:00 label with no visual reference for where ":15" actually is — readable, but not polished. There's also no zoom control (the 64px/hour is hardcoded; can't expand to see minute detail or compress to see a wider window) and no proper week grid.

### Fix size
**SMALL** to add half-hour gridlines + minute marks (style + ~10 lines in the label loop). **MEDIUM** to add a zoom toggle (small/medium/large per-hour pixel constants, keep persisted in `S.profile`). **LARGE** to ship a proper 7-day grid view alongside the day view.

### Demo risk if we DON'T fix
**LOW** — looks clean at hour resolution. Only matters if you explicitly point at a 14:15 task and judges squint.

### Breakage risk if we DO fix now
**LOW** for gridlines (purely additive style). **MEDIUM** for zoom (have to keep `TL_HOUR_PX` and `TL_PX_MIN` in sync everywhere they're read — drag-to-reschedule logic at `app_v58.js:3441-3451` depends on them).

---

## #6 — Emergency mode (in the exams section)

### Code location
- `app_v58.js:4418` — `scheduleExamCrunch(examId)`, the actual implementation
- `app_v58.js:4550` — the "מצב חירום" button rendered inside the exam dashboard, calls `scheduleExamCrunch('${ex.id}')`
- `app_v58.js:4561` — `recalcExamFocus` toast confirms emergency mode is the canonical replacement for the (removed) AI exam advisor
- Dead state: `let _emergencyPlan = null;` at `app_v58.js:213` is declared but never read anywhere — orphan from a removed prototype

### What exists today
"Emergency mode" = **the crunch scheduler**, triggered by a red `מצב חירום` button on each exam's dashboard. Active only when 1 ≤ daysLeft ≤ 21. Algorithm: computes a 2–4 day crunch window (shortened if a previous exam is within 10 days), pulls available time slots via `getAvailableSlots`, packs up to 2 sessions/day of `{name: course, duration: 90 דק', priority: גבוה, isCrunch: true}`, skips slots already taken by other courses, shows a `confirm()` dialog with the count, removes any prior crunch tasks for the same course in the window (to avoid duplicates on repeat clicks), then adds the new ones. **Fully implemented and wired to the UI.**

### What's missing / broken
Nothing functionally. Minor cosmetic issues: the orphan `_emergencyPlan` variable at line 213, and the `confirm()` dialog at line 4469 is a native browser confirm (ugly) instead of a styled modal. The button's prominence is reasonable on the exam dashboard but invisible elsewhere — no global hint that the feature exists.

### Fix size
**TRIVIAL** to delete the orphan `_emergencyPlan` variable. **SMALL** to swap the native confirm for a styled one. **SMALL-to-MEDIUM** to add discoverability (e.g., auto-banner the emergency CTA on the today page when an exam is < 7 days away).

### Demo risk if we DON'T fix
**NONE** if you navigate to an exam and click the button. **LOW** otherwise — judges might not discover the feature without prompting.

### Breakage risk if we DO fix now
**NONE** for the orphan delete. **LOW** for the rest.

---

## #7 — Onboarding tour expansion

### Code location
- `index.html:2189-2198` — the `_TOUR` array (8 steps)
- `index.html:2202` — `_TOUR_VER = 2` (bumping this re-shows the tour to existing users)
- `index.html:2282-2300` — `sfStartTour`, `_sfRT`, `sfTourNext`, `sfTourDone` (the tour overlay rendering + state)
- `index.html:2306-2310` — auto-fires after page load if `userName` set and `tourDone` false

### What exists today
**8 steps**, each `{icon, title, desc}`. Steps cover: welcome → today page → planner → exams → tasks/homework → hobbies (with text directing the user to find them inside Planner) → anchors → weekly review. The tour overlay is a **single modal in the center of the screen** — it doesn't navigate the user to each page, doesn't highlight specific UI elements, doesn't show the actual feature it's describing. It's pure descriptive text with dot indicators and Next/Skip buttons. Versioning works: bumping `_TOUR_VER` forces existing users back through the tour. Notable gap: **none of our hackathon work is covered** — no mention of schedule upload, ICS import, drag-and-drop, the AI assistant.

### What's missing / broken
"Feature-by-feature, section-jumping guide" would need: (a) each step calls `showPage(name)` before showing, so the user lands on the right page; (b) ideally a spotlight/highlight on the specific button being introduced; (c) steps added for new features (schedule upload, ICS import, AI assistant, focus lock, exam emergency mode); (d) maybe interactive steps where user clicks the actual button to advance.

### Fix size
- **SMALL** to add `page` field per step + `showPage(s.page)` call inside `_sfRT` → tour now navigates. Plus 3-5 new steps for hackathon features. ~30 min.
- **MEDIUM** to add an element spotlight (query the target element by ID/selector, render a halo/cutout overlay). ~1.5 h.
- **LARGE** for full interactive tour where steps wait for the user to perform an action before advancing. Probably not worth it for hackathon scope.

### Demo risk if we DON'T fix
**LOW-MEDIUM** — opening the demo as a "fresh user" runs the existing tour, which is decent enough but doesn't show off the schedule-upload moment (your magic-trick feature). Judges who don't click the camera CTA themselves miss the demo's strongest beat.

### Breakage risk if we DO fix now
**LOW** for the navigate-per-step + new steps. The tour overlay code is self-contained at `index.html:2189-2310` and doesn't interact with anything outside `sf_guide_v1` localStorage. Bumping `_TOUR_VER` re-fires the tour for testers, which you'd want anyway.

---

## Cross-cutting prioritization (for your eyes only)

If you have ~1 hour of demo-shaping time left, the order of bang-per-buck is:

1. **#7 navigate-per-step + 3 new steps** (SMALL, LOW risk, MEDIUM demo upside) — makes the schedule upload moment visible to anyone running the tour.
2. **#6 orphan delete + emergency CTA banner on today when exam <7d** (SMALL, LOW risk, LOW demo upside) — minor polish.
3. **#5 half-hour gridlines** (SMALL, LOW risk, LOW demo upside) — visual polish.
4. **#3 feedback loop** — skip unless you really want it. MEDIUM time, HIGH breakage risk.
5. **#4** — nothing to do.

No code touched. No commits. Report only.
