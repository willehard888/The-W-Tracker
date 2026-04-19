---
name: AI Coach
description: Elite-only streaming AI chat coach using GPT-5 via Lovable AI Gateway, no free teaser
type: feature
---
- Route: `/coach`, BottomNav tab visible only when `isElite` is true
- Free users hitting `/coach` see `FeatureGateScreen` with `requiresElite` → routes to `/paywall`
- Edge function `ai-coach` validates JWT + checks `profiles.is_elite=true` server-side (returns 403 otherwise)
- Model: `openai/gpt-5` via `https://ai.gateway.lovable.dev/v1/chat/completions`, streaming SSE
- System prompt injects user context (tier, level, XP, streak) and locks tone (sharp, no fluff, replies in user's language)
- Last 20 turns sent; messages persisted in `localStorage` (`w_coach_messages_v1`, capped 40)
- UI: gold gradient header, suggestion chips on empty state, markdown rendering via `react-markdown`, haptics on send, abortable stream
- Errors surfaced via toast: 429 = rate limited, 402 = credits exhausted
