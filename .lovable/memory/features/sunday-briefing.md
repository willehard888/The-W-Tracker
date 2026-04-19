---
name: Sunday Briefing
description: Weekly AI-generated briefing for Elite users, sent Sundays via cron with shareable image
type: feature
---
- Table `weekly_briefings`: headline, summary_md, key_insights[3], next_week_protocol[3], stats_snapshot, viewed_at, unique on (user_id, week_start)
- Edge function `weekly-briefing-generate`: runs Sundays 19:00 UTC via pg_cron, fetches Elite users with ≥3 checkins this week
- AI: `google/gemini-3-flash-preview` with tool-calling for structured output (`emit_briefing` tool)
- System prompt forces user's language, sharp tone, concrete numbers, no clichés
- Stats computed in code (avg sleep/hydration, workouts, perfect days, best/worst day, completion %)
- Push notifications logged for now (same pattern as `notify-message`)
- Frontend: `/briefing/:id` route, hero gold-gradient headline, stats grid, insights list, protocol cards, markdown summary
- Share button: html2canvas → 1080×1440 PNG via `BriefingShareCard`, native share or download fallback
- Index.tsx shows latest briefing card (Elite + < 7 days), styled gold with FileText icon
