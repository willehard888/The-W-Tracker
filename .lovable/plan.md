# Make W Coach actually work + curated FAQ answers

## Problems today
1. **Chat is fragile.** The suggested-question chips in `TrainerBrief` and `ChatSheet` always hit `ai-coach` (streaming GPT-5). If the gateway is slow, rate-limited, or the user is on a flaky connection, the most common questions feel broken. There's also no instant feedback — every tap waits on a network round-trip.
2. **No real FAQ.** "Suggested questions" are just prompts; tapping one starts a fresh AI call with zero guarantee of quality or speed.
3. **Suggestions are unstable.** They come from `coach-daily-brief` so they change daily and there's no canonical, premium-quality answer attached to any of them.

## What we'll ship

### A) A real, curated FAQ knowledge base
Create `src/lib/coach-faq.ts` — ~12 high-value questions a serious athlete actually asks, each with:
- `id`, `question`, `category` (Training | Recovery | Nutrition | Mindset | Program)
- `answer_md` — premium markdown answer (3–6 sentences, written in W Coach voice, with one bold takeaway and a final action line)
- `tags` for matching free-text questions to a FAQ entry

Examples (final list curated in code):
- "Should I train if I slept under 6h?"
- "What should I eat post-workout?"
- "How do I deload properly?"
- "How long until I see results?"
- "Cold shower before or after training?"
- "How do I fix a broken streak mentally?"
- "Cardio on lifting days — yes or no?"
- "How much protein do I actually need?"
- "Pre-bed wind-down in 5 minutes?"
- "I'm stalling on my main lift — what now?"
- "Travel week — how do I not lose progress?"
- "When should I switch programs?"

### B) Instant FAQ rendering in chat
In `ChatSheet.send()`:
- Before calling `ai-coach`, run `matchFaq(text)` (exact id match for chip taps; tag/keyword scoring for typed input above a threshold).
- On match: push the user message + an assistant message with the canned `answer_md` immediately, with a tiny "Answered from W Coach playbook · Ask follow-up for more" footer. No network call. Still saved to localStorage so the conversation continues naturally.
- On miss or if the user asks a follow-up: fall back to the existing streaming AI call (unchanged).

### C) FAQ surface in the UI
- **`TrainerBrief`**: keep the daily AI-generated suggestions, but append a small "Playbook" row with 3 rotating FAQ chips (deterministic by date so they feel curated, not random). Tap → opens chat with the canned answer pre-rendered.
- **`ChatSheet` empty state**: replace the 4 hard-coded `SUGGESTIONS` with the top 6 FAQ entries, grouped under a "Quick answers" label. Each chip carries its `faq_id` so the answer is instant.
- Add a tiny "Browse playbook" link in the empty state that opens an in-sheet list of all FAQs (simple scrollable list, tap to insert answer).

### D) Reliability fixes for the chat itself
- In `ChatSheet.send()`, when the network/stream fails, currently we drop the user message silently. Change to: keep the user message, add an assistant message "Coach lost connection — tap to retry" with a retry button that re-runs `send(lastUserText)`.
- Stop sending stale `localStorage` history on first open if it's > 24h old (current behavior reuses old context forever). Add a "New chat" button in the sheet header to clear.
- Pass `faq_hits` (matched FAQ ids in this conversation) to `ai-coach` so AI follow-ups don't repeat the canned answer.

### E) Backend tweak (small)
`supabase/functions/ai-coach/index.ts`:
- Accept optional `faq_context` in body. If present, append to system prompt: *"The user just read the playbook answer to: '…'. Do not repeat it — go deeper or answer their follow-up."*
- No schema/migration changes needed.

## Files

**New**
- `src/lib/coach-faq.ts` — FAQ data + `matchFaq(text)` helper
- `src/components/coach/FaqBrowser.tsx` — scrollable list inside ChatSheet

**Edited**
- `src/pages/Coach.tsx` — ChatSheet empty state, instant-answer path in `send()`, retry on failure, "New chat" button, stale-history guard
- `src/components/coach/TrainerBrief.tsx` — append Playbook chip row
- `supabase/functions/ai-coach/index.ts` — accept `faq_context`

## Out of scope
- No new tables, no new edge functions, no migrations.
- Daily brief generation stays as-is.

## Technical notes
- `matchFaq`: lowercase + strip punctuation, score by tag overlap; threshold ≥ 2 tag hits OR exact id. Keep it dumb and fast — the chips cover 90% of taps anyway.
- FAQ answers are written in the same voice as the system prompt (calm mentor by default, bold key numbers, end with one action). They should read as if the AI wrote them — users shouldn't notice the difference except for speed.
- Rotating Playbook chips: `faqs[(dayOfYear + i) % faqs.length]` so the same 3 show all day but rotate daily.
