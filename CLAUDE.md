# CLAUDE.md — StudyFlow

## Quick context

- **What:** Hackathon project for **Afkaton 10** — Afeka College's 10th hackathon. Submission is this **Thursday**.
- **Team idea:** "Smart Time Optimiser" — productivity / time-management for students. The repo is named StudyFlow; exact scope to be discovered from the existing code.
- **My role:** **Code lead.** I am Adir — the implementer and head of code on this team.
- **Constraint:** ~24 hours, judging at the end. **Demo > everything else.**

---

## First run — do this every fresh session

1. **Explore the repo before writing any code.** Run `ls`, read `package.json` (or equivalent), scan source folders, identify the framework, dependencies, and what's already built.
2. **Write a one-paragraph summary** of what you found at the top of `NOTES.md` (create the file if missing). Include: detected stack, what works, what's stubbed, what's missing for a winning demo.
3. **Confirm the branch.** Never work on `main`. If a working branch doesn't exist yet, create one (`git checkout -b adir/dev` or similar) and stay on it for all changes.
4. **Identify the gap** between current state and demo-ready, and tell me before you start building. I'll decide priorities.

---

## Stack preferences

The repo may be plain HTML/JS or something else — I haven't confirmed yet. **My home turf is Next.js 15 (App Router) + Supabase + TypeScript + Tailwind + shadcn/ui.** I'm on Windows.

**Before suggesting a migration:** calculate the cost. How many hours does the rewrite eat vs. how many features it costs us? If the answer isn't obviously in favor of migrating, **don't migrate** — work with what exists. A working ugly demo beats a half-built clean one.

If we do migrate, do it surgically: keep the existing UI as reference, port one feature at a time, keep the demo path runnable at every commit.

---

## Hackathon operating principles

- **Demo-first.** Every decision is judged by "does this make the 90-second demo better?" If no, defer.
- **One golden path.** Pick the single user flow being demoed and make it bulletproof. Everything else can be rough.
- **MVP > polish.** Working ugly beats broken pretty. Polish only what the judges will see.
- **No premature abstractions.** Hardcode happily. No "generic systems."
- **Keep the last 4 hours sacred.** Reserved for pitch rehearsal and recording a backup demo video in case live demo fails.
- **Ask, don't guess.** When intent is ambiguous, two-line clarifying questions are cheap. 30 minutes of wrong direction is expensive.

---

## Communication style with me

- **Hebrew or English are both fine** — respond in whichever I write to you in. I'm an Israeli developer; RTL support matters if we touch UI text.
- **Direct, practical, no fluff.** No over-apologizing. Tell me what you did and what broke.
- **Show, don't summarize.** When you finish a change, show the diff or file path, not a paragraph describing it.
- **Surface tradeoffs.** When you take a shortcut, say what tech debt we just took on so I can decide if it's acceptable.
- **Push back when I'm wrong.** If I'm about to make a bad call (premature feature, wrong abstraction, scope creep, panic-migration) — say so.

---

## Guardrails

- **No biometric / face / voice cloning features.** Decided against this category for privacy reasons.
- **No secrets in git.** API keys go in `.env.local`, ensure `.gitignore` covers it. If you spot a leaked key, flag it immediately.
- **No force-pushing shared branches.** The team works on this repo too.
- **Don't delete code I didn't ask you to remove**, even if it looks unused, without flagging it first.
- **Commit often** with clear messages. Small commits we can revert.

---

## Definition of done (per task)

A change is "done" when:
1. It runs locally without errors.
2. The demo path still works end-to-end.
3. I've seen the diff and approved it.
4. It's committed on the working branch with a clear message.

---

## About me (for context when making judgment calls)

- I run a small web dev agency (**JustBetterSite**) and recently shipped a production sales-pipeline tool — I'm comfortable with full-stack work, Hetzner, Docker, Caddy, Next.js, Supabase.
- I'm a student at Afeka, so this hackathon matters to me beyond the prize.
- I prefer **direct, practical advice with clear deliverables** — clean JSON, plain-language summaries alongside the technical work, no over-explaining.
