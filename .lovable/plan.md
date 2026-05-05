# Goal
Make `coach-generate-program` produce **coach-grade, varied 4-week blocks** and make `ai-coach` chat **actually useful** (knows the program, today's session, recent reflections, can act, not just talk).

---

## 1. Program generator — real quality + variety

### A. Movement library (new file `supabase/functions/coach-generate-program/movements.ts`)
Curated catalog grouped by **pattern × equipment × difficulty × injury contraindications**:
- Patterns: `squat`, `hinge`, `vertical_push`, `horizontal_push`, `vertical_pull`, `horizontal_pull`, `lunge`, `carry`, `rotation`, `core_anti`, `conditioning`.
- Each entry: name, equipment[], primary_muscles[], contra[] (e.g. `lower_back`, `knee`), difficulty 1–3, default rep range, default rest, tempo hint, regression, progression.
- ~120 movements covering bodyweight, dumbbells, barbell, kettlebell, bands, machines, cable, rower/bike/run.

The generator passes the **filtered subset** (matching user equipment, excluding contraindicated by injuries) to the model so the AI can only choose realistic, safe movements — and is **forced to vary** by pattern across the week.

### B. Stronger prompt + schema rules
Tighten `emit_program` tool + system prompt:
- **Pattern coverage rule**: each training week must hit all primary patterns relevant to the goal (e.g. hypertrophy: squat+hinge+H-push+V-push+H-pull+V-pull at least once).
- **No-repeat rule**: same exercise cannot appear on two consecutive training days.
- **Progression model**: every week must specify per-exercise progression (`+2.5kg`, `+1 rep`, `−10s rest`, `RPE +0.5`) in `progression_note` AND `notes` per main lift.
- **Real numbers**: use the athlete's `weight_kg` to suggest absolute load bands when equipment includes barbell/dumbbell ("DB press: ~30–35% BW per hand").
- **Warm-up A/B**: 2 lines — general (RAMP) + specific ramp sets for the day's main lift.
- **Deload trigger**: explicit if/then in prompt (already there, kept).
- **Conditioning variety**: rotate Z2 / threshold / VO2 / strongman finisher / mobility flow across the 4 weeks.
- **Test day**: week 4 includes one PR/AMRAP opportunity unless deload triggered.

### C. Reasoning + retries
- Switch model call to `openai/gpt-5` with `reasoning: { effort: "high" }`.
- Add **server-side validator** after the tool call:
  - days_per_week matches profile.training_days_pref
  - no duplicate primary movement within 48h
  - every block uses only allowed equipment
  - every working set has sets/reps/rpe/rest
- If validation fails → 1 automatic regeneration with the violations fed back as a `user` correction message. After 2 fails, return 422 with details.

### D. UI polish (`ProgramWeekAccordion`, `TodaySessionCard`)
- Show **warmup / cooldown / tempo / rest / alt** (already in schema; ensure all are surfaced in TodaySessionCard).
- Add per-exercise "Why this?" tooltip pulled from `notes`.
- Show **progression delta** vs prior week per main lift.

---

## 2. AI Coach chat — actually intelligent

### A. Richer context (in `ai-coach/index.ts`)
Already injects: profile, athlete, 7d check-ins, last briefing, today's session, FAQ context.
Add:
- **Last 3 reflections** (RPE/energy/sleep/mood/friction) — turns vague advice into specific.
- **Active goals + progress %** from `coach_goals`.
- **Last 5 program logs** (completed/skipped + perceived RPE) → coach can call out drift.
- **Tier risk + streak** already covered via profile.
- **Today's date + day-of-week** explicitly so it stops guessing.

### B. Tool calls (turn chat into an agent)
Expose 4 tools the model can call (handled server-side, returned as structured assistant messages the UI renders as action chips):
1. `log_today_session(perceived_rpe, notes)` → writes `coach_program_logs`.
2. `adjust_today_session(reason, swaps[])` → stores override in `coach_program_logs.notes`.
3. `set_goal(title, metric, target_value, unit, deadline)` → inserts into `coach_goals`.
4. `flag_recovery(severity, reason)` → triggers tomorrow's session to deload via a flag row.

Streaming response remains; tool calls are detected and surfaced to the UI as confirm-buttons before execution (no silent writes).

### C. Reasoning + style discipline
- `reasoning: { effort: "medium" }` on chat completion.
- System prompt addition: "Before answering, silently identify (1) the gap, (2) the cheapest intervention, (3) the next 24h action. Reply must contain those three, in that order, in ≤6 sentences unless asked for depth."
- Add **"Go deeper"** chip in UI that resends the last exchange with `effort: "high"` and `max_tokens` raised.

### D. FAQ Playbook expansion
- Grow `src/lib/coach-faq.ts` from 12 → ~30 entries covering: deload signs, travel weeks, sick-day protocol, plateau breakers, sleep debt recovery, cutting vs maintaining, injury return, RPE explained, rep ranges per goal, supplements baseline, caffeine cutoff, mobility minimums, mindset reset.
- Improve matcher: add per-entry synonyms array, stem-aware tokenization (drop trailing s/ing/ed), require min score 2 to match (avoid false positives sending users to FAQ when they want chat).

### E. Reliability
- Keep stale-history guard + retry chip (already in place).
- Add **abort on close**: aborting the in-flight stream when the sheet closes.
- Persist chat to Supabase (`coach_chat_messages` table, RLS by user_id) so it survives device changes; localStorage stays as cache.

---

## Technical details

**New files**
- `supabase/functions/coach-generate-program/movements.ts` — movement catalog + filter helpers.
- `supabase/migrations/<ts>_coach_chat_messages.sql` — `coach_chat_messages(id, user_id, role, content, created_at)` + RLS (user can CRUD own).

**Edited files**
- `supabase/functions/coach-generate-program/index.ts` — pass filtered movement library, harden prompt, add validator + 1 retry, enable reasoning.
- `supabase/functions/ai-coach/index.ts` — extra context (reflections/goals/logs), 4 tools, reasoning, tool-call passthrough in stream.
- `src/pages/Coach.tsx` — render tool-call action chips, "Go deeper" button, persist chat to backend, abort on close.
- `src/components/coach/TodaySessionCard.tsx` — surface warmup/cooldown/tempo/rest/alt + progression delta.
- `src/components/coach/ProgramWeekAccordion.tsx` — show progression deltas, "Why this?" notes.
- `src/lib/coach-faq.ts` — expand to ~30 entries, stronger matcher.

**No DB schema changes** other than `coach_chat_messages`. Existing `coach_programs.plan_json` already allows the richer fields.

---

## Out of scope
- Exercise video library / GIFs.
- Multi-week auto-regeneration cron.
- Voice coach / TTS.
