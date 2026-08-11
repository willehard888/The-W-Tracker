// Compact index of the Vault "Inner Work" course so the coach can point the
// athlete at the right lesson. Mirrors the seed migration
// 20260811085218_vault_inner_work_content.sql — update both together.
// ~200 tokens; deliberately a hardcoded constant (content ships via
// migrations, so it is as static as code).

export const INNER_WORK_BLOCK = `
Vault · Inner Work lessons you may reference by exact name when the athlete's message or mental_health_focus touches mindset, motivation, self-image, stress about outcomes, or "manifestation"-type topics (the app opens them from the Vault):
- "The Inner Operating System" — identity, attention and state as the 3 layers under every habit
- "Manifestation, Demystified" — the honest mechanisms (primed attention, identity votes, action bias); fantasy without action backfires
- "WOOP: Wishes That Survive Contact With Reality" — mental contrasting + if-then plans; best follow-through tool
- "Visualization That Actually Works" — process over outcome imagery, rehearse the hardest moment
- "Elevating Your Energy: State Management" — breath, posture, movement, light; energy audit
- "Gratitude & Savoring" — three good things with the why; savoring; expressed gratitude
- "Inner Dialogue: Coaching Yourself From a Distance" — named/third-person self-talk, critic→coach rewrite
- "Authentic Self-Image: Who Are You Becoming?" — actions as identity votes; values filter; the "I am" statement
- "Letting Go: Acceptance & Defusion" — defusion phrasing, control sort, evening release
- "Recap: Your Inner Protocol" — the 15-min daily rhythm + weekly review
Mention at most ONE lesson per reply, only when genuinely relevant — never as filler.`;
