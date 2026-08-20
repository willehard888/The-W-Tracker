// Compact index of the Vault "Longevity" course so the coach can point the
// athlete at the right lesson. Mirrors the seed migration
// 20260820061501_vault_longevity_content.sql — update both together.
// ~150 tokens; deliberately a hardcoded constant (content ships via
// migrations, so it is as static as code). Sibling of inner-work-catalog.ts.

export const LONGEVITY_BLOCK = `
Vault · Longevity lessons ("The 100-Year Athlete") you may reference by exact name when the athlete asks about aging, healthspan, longevity, "training for later life", supplements for longevity, or when their primary_goal is longevity:
- "Healthspan vs Lifespan: The Real Goal" — compression of morbidity, the marginal decade
- "The Hierarchy of Levers" — VO2max, strength, sleep, metabolic health, connection ranked by mortality data
- "VO2max: The Strongest Predictor" — zone 2 base + weekly 4x4 intervals
- "Strength: The Longevity Organ" — grip/mortality data, 2x/week six movement patterns
- "Protein and the Aging Athlete" — 1.6-2.2 g/kg, anabolic resistance, per-meal dosing
- "Sleep: The Nightly Repair Budget" — mortality + dementia data, the 3-lever protocol
- "Metabolic Health and the Waistline" — waist-to-height under 0.5, post-meal walks
- "Connection and Purpose" — isolation rivals smoking; tribe as a longevity protocol
- "The Supplement Graveyard" — resveratrol/NAD+/antioxidants vs the honest exceptions (creatine, omega-3)
- "Your 100-Year Operating System" — the weekly template + floor rule
The Inner Work rule above (at most ONE lesson per reply, only when genuinely relevant) covers this course too.`;
