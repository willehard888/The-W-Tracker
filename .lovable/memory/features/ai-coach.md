---
name: AI Coach
description: Member-only streaming AI chat coach using GPT-5 via Lovable AI Gateway, with 7d memory + proactive morning nudges
type: feature
---
- Route: `/coach`, BottomNav tab visible to any active member (no Elite gate)
- Edge function `ai-coach` validates JWT + checks `has_active_access(user_id)` server-side (returns 403 if no active membership/trial)
- Model: `openai/gpt-5` via `https://ai.gateway.lovable.dev/v1/chat/completions`, streaming SSE
- **Memory**: system prompt injects 7-day stats summary (workouts, sleep, hydration, perfect days, yesterday detail) + last briefing's `key_insights`
- Last 20 turns sent; messages persisted in `localStorage` (`w_coach_messages_v1`, capped 40)
- UI: gold gradient header, suggestion chips on empty state, markdown rendering via `react-markdown`, haptics on send, abortable stream
- Errors surfaced via toast: 429 = rate limited, 402 = credits exhausted

## Proactive Morning Nudges
- Table `coach_nudges`: id, user_id, headline, content, created_at, seen_at
- Edge function `coach-morning-nudge`: runs daily 07:00 UTC via pg_cron
- Per active member with checkin yesterday: AI generates 1-2 sentence focus via `emit_nudge` tool call (gemini-3-flash)
- One nudge max per user per day (skip if any nudge today)
- `CoachNudgeCard` on Index.tsx (unseen): gold card with sparkles icon, taps → `/coach`
- Coach.tsx prefills input with nudge context (`w_coach_nudge_context` sessionStorage), nudge marked seen on tap
