## Goal

Today's Vault is **20 short articles in 5 categories** — informative but flat (a body blob + bullets + refs). The user feedback: make it feel like a **real course you actually learn from**, not a content dump.

We restructure each category into a **5-lesson mini-course** with a clear arc, pedagogical scaffolding, key takeaways, a quick comprehension check, and per-user progress that drives a visible completion ring.

No content is lost — existing 20 articles become Lessons 2–5 of each course; we add a "Lesson 1: Foundations" intro per category, plus a **Course Outline** view that replaces the current accordion list.

---

## What changes (UX)

### 1. Category card → opens the Course, not a flat article list

Tapping a category opens a full-screen **CoursePage** (`/vault/:categoryId`) with:

- **Hero**: course title, accent color, 1-line promise ("By the end you'll know exactly how to dose protein for muscle, recovery and longevity"), progress ring (0/5 lessons), estimated total time.
- **Course outline**: 5 numbered lesson cards (Foundations → 4 protocols → Recap). Each shows lesson number, title, ~time, evidence chip, and a check when completed.
- **"Start lesson 1" CTA** that always points to the next unfinished lesson.

### 2. Lesson sheet (replaces today's article sheet)

Each lesson is broken into pedagogical blocks instead of one body blob:

```text
┌─ Lesson 2 of 5  ·  Recovery & Sleep  ─────────────┐
│  Why It Matters         (1 short paragraph)        │
│  ── The Science ──      (current body_md)          │
│  ── Protocol ──         (current protocol struct)  │
│  ── Try This Today ──   (1–3 concrete actions)     │
│  ── Watch-outs ──       (current risks)            │
│  ── Key Takeaways ──    (3 bullets, bolded)        │
│  ── Quick Check ──      (2 single-choice Qs)       │
│  ── References ──       (current references_json)  │
│                                                    │
│  [ Mark lesson complete → ]                        │
└────────────────────────────────────────────────────┘
```

After "Mark complete", we record progress, animate a check on the outline, and offer **"Continue to lesson 3 →"**. Finishing all 5 unlocks a **Course Complete** state with a subtle gold flourish + "200 XP" reward note (no XP awarded yet — see "Out of scope").

### 3. Course outline shows real progress

- Completed lessons: green check + dimmed.
- Current lesson: accent ring.
- Locked? **No** — all lessons are accessible in any order; we just nudge sequence.
- Course-level progress ring on category card on `/vault` (e.g. "3 / 5").

### 4. Vault landing page tightened

- Remove the inline accordion expansion. Category card becomes a single tap → push to course route.
- Stats trio updates: "5 courses · 25 lessons · 60+ citations".
- Banner stays.

---

## What changes (data)

### Schema additions to `vault_articles`

Add columns that map directly to the new lesson blocks:

- `lesson_number int` (1–5 within category, drives ordering)
- `why_it_matters text` (1 short paragraph, intro hook)
- `try_today text[]` (1–3 concrete actions for "Try This Today")
- `key_takeaways text[]` (exactly 3 bullets)
- `quiz jsonb` — shape: `[{ q: "...", choices: ["a","b","c"], correct: 0, explain: "..." }, ...]` (2 questions per lesson)
- `course_role text check in ('foundations','protocol','recap')` default `'protocol'`

Existing fields (`title`, `subtitle`, `summary`, `body_md`, `protocol`, `benefits`, `risks`, `references_json`, `evidence_tier`, `read_time_min`) all stay and map naturally.

### New table `vault_lesson_progress`

```sql
create table public.vault_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  article_id uuid not null references public.vault_articles(id) on delete cascade,
  completed_at timestamptz not null default now(),
  quiz_score int,                  -- 0..2
  unique (user_id, article_id)
);
alter table public.vault_lesson_progress enable row level security;

create policy "Users read own lesson progress"
  on public.vault_lesson_progress for select to authenticated
  using (auth.uid() = user_id);

create policy "Premium users mark own lessons complete"
  on public.vault_lesson_progress for insert to authenticated
  with check (auth.uid() = user_id and public.has_premium(auth.uid()));

create policy "Users delete own lesson progress"
  on public.vault_lesson_progress for delete to authenticated
  using (auth.uid() = user_id);
```

### Content migration (one SQL migration)

For each of the 5 categories:

1. **Insert 1 new "Foundations" lesson** (lesson_number=1, course_role='foundations') — short framing piece: what this course covers, who it's for, the mental model (e.g. for Recovery: "sleep is the dose, light is the timer, cold is the optional cherry").
2. **Update the existing 4 articles** to set `lesson_number = 2..5`, `course_role='protocol'`, and populate `why_it_matters`, `try_today`, `key_takeaways`, `quiz` with course-level pedagogy authored from existing `body_md` + protocol.

This yields **5 categories × 5 lessons = 25 lessons** total. Stats line in hero updates to match.

We do **not** add a separate "Recap" lesson — Foundations + 4 protocols is the right pace for a starter course; the last protocol's "Course Complete" state plays the recap role.

---

## Files

### New
- `src/pages/VaultCourse.tsx` — full-screen course page (`/vault/:categoryId`)
- `src/components/vault/CourseOutline.tsx` — numbered lesson list with progress checks
- `src/components/vault/CourseProgressRing.tsx` — small SVG ring (used on `/vault` cards + course hero)
- `src/components/vault/LessonSheet.tsx` — replaces VaultArticleSheet; blocks-based layout, sequential nav
- `src/components/vault/LessonQuiz.tsx` — 2-question single-choice check with inline explanations
- `src/hooks/use-vault-progress.ts` — reads `vault_lesson_progress`, exposes `markComplete(articleId, score)` + per-course `{ completed, total }`
- `supabase/migrations/<ts>_vault_course_structure.sql` — schema additions + new table + RLS
- `supabase/migrations/<ts>_vault_seed_course_content.sql` — Foundations inserts + lesson_number/quiz/takeaways updates for existing 20 rows

### Edited
- `src/pages/Vault.tsx` — remove inline accordion; category cards push to `/vault/:categoryId`; show per-course progress ring; update stats trio.
- `src/hooks/use-vault-articles.ts` — extend `VaultArticle` type with new fields; add `lesson_number` to ordering.
- `src/App.tsx` — add `<Route path="/vault/:categoryId" element={<VaultCourse />} />`.
- `src/components/vault/VaultArticleSheet.tsx` — delete (replaced by LessonSheet).

---

## Technical notes

- **Premium gate** stays identical: route guard in `VaultCourse` mirrors `Vault.tsx` (`useEffect` redirect to `/paywall` if `!isPremium`).
- **Ordering**: queries change from `display_order` → `lesson_number`. We keep `display_order` for backward compat but stop relying on it.
- **Progress hook** uses TanStack Query with `staleTime: 60_000`. `markComplete` is an `upsert` (`onConflict: 'user_id,article_id'`) so re-completing is idempotent and quiz score can be updated.
- **Quiz UX**: pick → instant green/red highlight + 1-line explanation; both questions answered enables "Mark lesson complete". Skipping the quiz is allowed (button reads "Mark complete without quiz").
- **Sheet portal pattern**: keep the proven `createPortal(..., document.body)` + `z-[1000]` from current `VaultArticleSheet` so the lesson sheet survives the TabHost / ModalStack stacking context.
- **Animations**: outline check uses a small framer-motion `scale 0 → 1` + haptic `impact("light")`. Course-complete state plays a single `Sparkles` flourish (no full-screen takeover).
- **Performance**: keep eager-fetch-and-cache pattern in `useVaultArticles`; add a parallel fetch for progress so the course outline renders complete state on first paint.

---

## Out of scope (for a follow-up)

- XP rewards for completing courses (need to confirm the right amount + whether it counts toward streaks).
- Bookmarks / "save for later".
- Audio narration of lessons.
- Admin CRUD UI for editing lessons (still migration-driven).
- Per-lesson share cards.

---

## What you'll see when this ships

1. `/vault` — same hero, but each category card shows a small **0/5** ring on the right.
2. Tap "Recovery & Sleep" → full course page with 5 numbered lessons, "Start Lesson 1 →" CTA.
3. Lesson sheet now reads like a lesson: hook → science → protocol → try today → takeaways → quick check → mark complete.
4. Finish all 5 → ring fills gold, "Course complete" caption, prompt to start the next course.
