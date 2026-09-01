// Curated AI Coach FAQ playbook — instant, premium answers (no network call).
// Voice: calm mentor, surgical, bold key numbers, end with one specific action.

export type FaqCategory = "Training" | "Recovery" | "Nutrition" | "Mindset" | "Program";

export interface FaqEntry {
  id: string;
  question: string;
  category: FaqCategory;
  tags: string[];
  /** Optional extra phrases that should also match (whole phrases, lowercased). */
  synonyms?: string[];
  answer_md: string;
}

export const COACH_FAQ: FaqEntry[] = [
  {
    id: "low-sleep-training",
    question: "Should I train if I slept under 6h?",
    category: "Recovery",
    tags: ["sleep", "tired", "fatigue", "recovery", "train", "skip", "rest"],
    answer_md:
      "Train, but **cut volume by 30–40%** and skip anything maximal — no PR attempts, no sprint work, no heavy singles.\n\nDo your warm-up honestly. If your top set feels harder than RPE 8, stop one set short. Replace conditioning with a brisk 20-min walk.\n\n**Action:** Train at 60–70% of planned volume, then in bed by 22:30 tonight to repay the debt.",
  },
  {
    id: "post-workout-meal",
    question: "What should I eat post-workout?",
    category: "Nutrition",
    tags: ["food", "eat", "meal", "protein", "post", "after", "workout", "nutrition", "carbs"],
    answer_md:
      "Within 60 minutes: **0.4 g/kg protein + 0.8 g/kg carbs**. For an 80 kg athlete that's ~30 g protein and ~65 g carbs.\n\nSimple options: chicken + rice + veg, Greek yogurt + berries + honey, whey shake + banana + oats. Add 500 ml water with a pinch of salt if you sweat hard.\n\n**Action:** Pre-portion tomorrow's post-workout meal tonight so you don't improvise hungry.",
  },
  {
    id: "deload-properly",
    question: "How do I deload properly?",
    category: "Program",
    tags: ["deload", "rest", "week", "recovery", "fatigue", "program"],
    answer_md:
      "A real deload keeps **frequency the same**, drops **volume by ~50%**, and drops **intensity to RPE 6–7**. Same lifts, same days, just lighter and shorter.\n\nDon't take the week off — that detrains motor patterns. Keep cardio easy, sleep +30 min, and walk daily.\n\n**Action:** This week, halve your sets and cap top sets at 70% 1RM. You'll come back sharper, not softer.",
  },
  {
    id: "results-timeline",
    question: "How long until I see results?",
    category: "Mindset",
    tags: ["results", "long", "time", "weeks", "see", "progress", "patience"],
    answer_md:
      "Honest timelines: **strength shifts in 2–3 weeks**, **visible composition change in 6–8 weeks**, **noticeable transformation in 12 weeks** — assuming consistency above 80% and sleep above 7h.\n\nThe trap is comparing week 2 to week 12 photos. Track one strength lift and one waist measurement weekly. Numbers don't flatter or lie.\n\n**Action:** Take a baseline photo and waist measurement today. Re-check on day 28.",
  },
  {
    id: "cold-shower-timing",
    question: "Cold shower before or after training?",
    category: "Recovery",
    tags: ["cold", "shower", "ice", "before", "after", "training", "recovery"],
    answer_md:
      "**After cardio: fine.** **After hypertrophy/strength: wait 6+ hours** — cold blunts the muscle-building signal for several hours post-lift.\n\nMornings are the best slot: 2–3 minutes, breathe slow, end cold. It sharpens focus without compromising adaptation.\n\n**Action:** Move your cold exposure to the morning, not post-lift.",
  },
  {
    id: "broken-streak",
    question: "How do I fix a broken streak mentally?",
    category: "Mindset",
    tags: ["streak", "broke", "missed", "motivation", "restart", "again", "fail", "mindset"],
    answer_md:
      "A broken streak isn't a verdict — it's data. The athletes who win long-term miss days too; they just **never miss twice in a row**.\n\nDon't try to \"make it up.\" That's how short streaks become long absences. Show up today at 60% effort if needed. The number rebuilds. Your identity doesn't have to.\n\n**Action:** Do the smallest viable check-in today — even one habit. Tomorrow you go full.",
  },
  {
    id: "cardio-on-lift-day",
    question: "Cardio on lifting days — yes or no?",
    category: "Training",
    tags: ["cardio", "lifting", "lift", "same", "day", "running", "interference"],
    answer_md:
      "Yes — but **separate them by 6+ hours** and keep cardio **zone 2 or short intervals under 15 min**. Long hard cardio within 4 hours of lifting blunts strength gains (interference effect is real).\n\nIf you must stack them: **lift first, cardio after**. Never sprint before squatting.\n\n**Action:** Schedule cardio AM, lift PM (or vice versa). 6 hours minimum between.",
  },
  {
    id: "protein-needs",
    question: "How much protein do I actually need?",
    category: "Nutrition",
    tags: ["protein", "grams", "much", "need", "daily", "intake"],
    answer_md:
      "For body composition + performance: **1.6–2.2 g per kg of body weight**, daily. Cutting? Stay at the top of that range. Maintenance? Bottom is enough.\n\nSpread across **3–5 meals of 30–50 g each** — your body can't bank it. Quality matters: whole eggs, meat, fish, dairy, whey. Plant-only? Add 20%.\n\n**Action:** Calculate your number now (bodyweight kg × 1.8) and hit it tomorrow. Track for 3 days.",
  },
  {
    id: "wind-down",
    question: "Pre-bed wind-down in 5 minutes?",
    category: "Recovery",
    tags: ["sleep", "bed", "wind", "down", "evening", "night", "routine", "relax"],
    answer_md:
      "The 5-min protocol:\n\n1. **Lights out, screens away** (1 min) — phone in another room.\n2. **Box breathing** 4-4-4-4 for 2 minutes.\n3. **Brain dump** — write tomorrow's 3 priorities on paper (1 min).\n4. **Body scan** lying down — relax from feet to scalp (1 min).\n\nIt drops cortisol fast. Most people fall asleep before they finish.\n\n**Action:** Set a 22:00 alarm tonight labeled \"wind-down.\" Run the protocol. Lights out by 22:30.",
  },
  {
    id: "stalled-lift",
    question: "I'm stalling on my main lift — what now?",
    category: "Training",
    tags: ["stall", "stalled", "stuck", "plateau", "lift", "weight", "progress", "main"],
    answer_md:
      "Stalls are usually one of three things: **insufficient recovery**, **technique drift**, or **too narrow a stimulus**.\n\nFix order:\n- 1 week deload (50% volume).\n- Film one top set — compare to a clean rep from a month ago.\n- Add a **variation** (pause rep, tempo, close-stance) for 3 weeks before returning to the main movement.\n\n**Action:** Film today's top set. Deload next week. Return with a variation.",
  },
  {
    id: "travel-week",
    question: "Travel week — how do I not lose progress?",
    category: "Program",
    tags: ["travel", "trip", "hotel", "vacation", "away", "maintenance", "minimum"],
    answer_md:
      "You won't lose meaningful muscle in **under 3 weeks** if you hit a maintenance dose: **2 short sessions per week, full-body, RPE 8**.\n\nMinimum kit anywhere:\n- Goblet squat or split squat × 3 sets of 10\n- Push-ups (or DB press) × 3 × AMRAP\n- DB row or inverted row × 3 × 10\n- Carry or plank × 2 × 45s\n\nProtein and sleep hold the line more than training does. Walk 8k+ steps daily.\n\n**Action:** Book the 2 sessions in your calendar before you fly. Pack a band.",
  },
  {
    id: "switch-program",
    question: "When should I switch programs?",
    category: "Program",
    tags: ["switch", "change", "new", "program", "plan", "different", "next"],
    answer_md:
      "Switch when **one** is true:\n- You've run it for **8–12 weeks** with consistent progression.\n- Progression has stalled for **3+ weeks** despite a deload.\n- Your goal has changed (cut → build, strength → hypertrophy, etc.).\n\nNever switch out of boredom — that's how people spend years as beginners. Variation lives **inside** the program (rep ranges, accessories), not by abandoning it.\n\n**Action:** Note today's date and current top set. Re-evaluate at week 8. If you're still progressing, stay.",
  },
  {
    id: "rpe-explained",
    question: "What does RPE actually mean?",
    category: "Training",
    tags: ["rpe", "rate", "perceived", "exertion", "scale", "hard"],
    synonyms: ["how hard", "how hard should i lift"],
    answer_md:
      "RPE = Rate of Perceived Exertion (1–10). For working sets:\n\n- **RPE 6** — 4 reps left in the tank\n- **RPE 7** — 3 left\n- **RPE 8** — 2 left (sweet spot for most hypertrophy)\n- **RPE 9** — 1 left (strength top sets)\n- **RPE 10** — true failure (rare, mostly for testing)\n\n**Action:** Pick your top set's RPE before you start. If your last rep felt easier than that, add load next set.",
  },
  {
    id: "sick-day",
    question: "I'm sick — should I train?",
    category: "Recovery",
    tags: ["sick", "ill", "cold", "flu", "fever", "throat", "train"],
    answer_md:
      "Use the **neck check**: symptoms above the neck (mild congestion, light sore throat) → easy session is fine. Symptoms below (fever, body aches, chest tightness, GI issues) → **rest**.\n\nForcing a session through a real infection extends recovery 3–7 days. A skipped day costs you nothing.\n\n**Action:** If fever or body aches, sleep + 3L water + protein. Reassess in 24h.",
  },
  {
    id: "plateau-fix",
    question: "How do I break a plateau?",
    category: "Training",
    tags: ["plateau", "stuck", "stalled", "no", "progress", "break", "stop"],
    answer_md:
      "Plateaus = stale stimulus or stale recovery. Run this audit:\n\n1. **Sleep** — under 7h for 2+ weeks? Fix that first, nothing else matters.\n2. **Calories** — eating maintenance while expecting gains? Add 200 kcal.\n3. **Stimulus** — same lifts, same reps, 6+ weeks? Change rep range or pick a variation.\n4. **Frequency** — bring the lift to **2× per week** for 4 weeks.\n\n**Action:** Run a 1-week deload, then return with one variable changed — not all four.",
  },
  {
    id: "cut-vs-bulk",
    question: "Should I cut or bulk?",
    category: "Nutrition",
    tags: ["cut", "bulk", "lean", "gain", "lose", "fat", "muscle", "phase"],
    synonyms: ["cutting or bulking"],
    answer_md:
      "Decide by **body fat estimate**:\n\n- Above ~18% (men) / 28% (women) → **cut** first. You'll see definition AND build muscle better when you return to surplus.\n- 12–18% / 22–28% → **lean recomp** at maintenance.\n- Below that → **slow surplus** (+200 kcal), gain ~0.25–0.5% bodyweight per week.\n\nCutting and bulking both work — never doing either is what stalls people.\n\n**Action:** Estimate BF in the mirror today. Pick one phase. Commit 8 weeks.",
  },
  {
    id: "sleep-debt",
    question: "Can I catch up on sleep on weekends?",
    category: "Recovery",
    tags: ["sleep", "debt", "weekend", "catch", "up", "tired", "recover"],
    answer_md:
      "Partially — yes. Adding **+1 to +2 hours** on weekends recovers ~70% of cognitive markers, but performance and hormones still suffer if weekday sleep stays under 6h.\n\nThe real fix is **bedtime**, not wake time. Move bedtime earlier in 15-min steps until you're hitting 7.5h.\n\n**Action:** Tonight, set a bedtime alarm 30 min earlier than usual. Hold for 7 days.",
  },
  {
    id: "caffeine-cutoff",
    question: "When should I stop caffeine?",
    category: "Recovery",
    tags: ["caffeine", "coffee", "espresso", "stop", "cutoff", "afternoon", "sleep"],
    answer_md:
      "Caffeine has a half-life of ~5–6 hours. To protect deep sleep: **no caffeine within 8 hours of bedtime**. If lights out is 23:00, last cup at **15:00**.\n\nIf you're sensitive: cap daily intake at 400 mg (~3 espressos). For pre-workout, 3–6 mg/kg ~30 min before is the performance window.\n\n**Action:** Set a 15:00 phone alarm labeled \"caffeine cutoff\" today.",
  },
  {
    id: "mobility-minimum",
    question: "What's the minimum mobility I need?",
    category: "Recovery",
    tags: ["mobility", "stretch", "stretching", "flexibility", "minimum", "daily"],
    answer_md:
      "**5 minutes daily beats 30 minutes weekly.** The non-negotiable trio:\n\n- **90/90 hip switch** — 8/side\n- **Cat-cow + thread the needle** — 8 each\n- **Couch stretch** — 60s/side\n\nDo it in the morning or as your cooldown. That's it. Add deeper work only if you have a specific restriction.\n\n**Action:** Set a daily 5-min reminder. Run the trio after your next session.",
  },
  {
    id: "supplements-baseline",
    question: "What supplements actually matter?",
    category: "Nutrition",
    tags: ["supplements", "supplement", "creatine", "vitamin", "fish", "oil", "magnesium"],
    answer_md:
      "Evidence-backed baseline:\n\n- **Creatine monohydrate** 5 g/day — strength, muscle, cognition. The most-studied supplement on earth.\n- **Vitamin D3** 2000–4000 IU/day if you don't get sun.\n- **Omega-3** 2–3 g EPA+DHA/day — recovery, mood, joints.\n- **Magnesium glycinate** 200–400 mg before bed if sleep quality is poor.\n\nSkip pre-workouts, BCAAs, fat burners. Real food first.\n\n**Action:** Pick the one missing from your shelf. Buy it this week.",
  },
  {
    id: "injury-return",
    question: "How do I come back from an injury?",
    category: "Training",
    tags: ["injury", "injured", "return", "comeback", "rehab", "pain", "back"],
    answer_md:
      "Three phases — never skip:\n\n1. **Tolerate** — pain ≤3/10 during, no flare-up after. Bodyweight or band versions, RPE 5.\n2. **Load** — slowly add weight, keeping pain ≤3. Add 5–10% per week.\n3. **Express** — return to full intensity once you're symptom-free for 2 weeks at 80%.\n\nIf pain >5/10 or worsens overnight → see a physio. Don't self-diagnose joints.\n\n**Action:** This week, train the injured pattern at RPE 5 only. No \"testing it.\"",
  },
  {
    id: "warmup-essentials",
    question: "What's the minimum effective warm-up?",
    category: "Training",
    tags: ["warmup", "warm", "up", "ramp", "before", "lift", "session"],
    answer_md:
      "5 minutes total:\n\n1. **Raise** (1 min) — bike, row, or jump rope to break a sweat.\n2. **Mobilize** (2 min) — 2 movements specific to today's main lift.\n3. **Ramp sets** (2 min) — main lift at 40%, 60%, 80% of working weight, 3–5 reps each.\n\nSkip random stretching. Skip foam rolling 15 minutes — diminishing returns.\n\n**Action:** Time your next warm-up. If it's over 10 min, you're stalling.",
  },
  {
    id: "rest-between-sets",
    question: "How long should I rest between sets?",
    category: "Training",
    tags: ["rest", "between", "sets", "wait", "long", "pause"],
    answer_md:
      "Match rest to goal:\n\n- **Strength (1–6 reps)** → 2.5–4 minutes.\n- **Hypertrophy (6–12)** → 90–120 seconds.\n- **Endurance / metabolic (15+)** → 30–60 seconds.\n\nUnder-resting strength sets is the #1 reason people stall. Use a timer — don't trust your phone scroll.\n\n**Action:** Set your watch timer for the right interval before your next session.",
  },
  {
    id: "morning-vs-evening",
    question: "Train morning or evening?",
    category: "Training",
    tags: ["morning", "evening", "afternoon", "time", "day", "best", "when"],
    answer_md:
      "**The session you'll do consistently > the \"optimal\" one.**\n\nThat said: peak strength is 4–8 hours after waking, so afternoon/evening sessions tend to outperform 6 AM by ~3–5%. Morning lifters need a longer warm-up.\n\n**Action:** Block the same training window 4 days this week — same time, same place. Consistency compounds.",
  },
  {
    id: "scale-anxiety",
    question: "Why is the scale not moving but I look leaner?",
    category: "Mindset",
    tags: ["scale", "weight", "not", "moving", "lean", "leaner", "recomp"],
    answer_md:
      "You're recomping — losing fat and gaining muscle simultaneously. This is the **best-case scenario**, but the scale hides it.\n\nUse two better signals:\n- **Waist circumference** (weekly, fasted morning).\n- **Same-light selfie** (weekly, same angle).\n\nThe scale lies day-to-day from sodium, glycogen, and stress. Trust trend, not a number.\n\n**Action:** Measure your waist tomorrow morning. Re-check on day 14.",
  },
  {
    id: "minimum-effective-dose",
    question: "What's the minimum I need to maintain?",
    category: "Program",
    tags: ["minimum", "maintain", "maintenance", "least", "busy", "minimal"],
    answer_md:
      "Maintenance dose for muscle and strength:\n\n- **2 sessions/week**, full-body, 4–6 working sets per major muscle.\n- One **hard set near failure** is enough per movement.\n- Sessions can be 30 min.\n\nThis maintains gains for months. Don't quit during life chaos — drop to maintenance and resume building when capacity returns.\n\n**Action:** Lock 2× 30-min sessions into your calendar this week. Non-negotiable.",
  },
  {
    id: "hydration",
    question: "How much water do I really need?",
    category: "Nutrition",
    tags: ["water", "hydration", "drink", "liters", "litres", "much"],
    answer_md:
      "Baseline: **30–35 ml per kg of bodyweight**. For an 80 kg athlete that's ~2.5–2.8 L. Add **+500 ml per hour of training**, more in heat.\n\nUrine color is the cheapest gauge — pale straw is the target. Clear all day = over-hydrated, dark = behind.\n\n**Action:** Fill a 1L bottle now. Drink 3 of them today. Done.",
  },
];

const STOP = new Set([
  "the","a","an","is","are","do","i","my","me","you","your","to","of","on","in","for","and","or","with","what","how","when","should","much","need","at","be","it","this","that","if","not","no","yes","can","get","got","really","actually","still","does","did","was","were","have","has","had","just","about","really",
]);

/** Light stemming: drop trailing s/es/ing/ed for common forms. */
const stem = (t: string): string => {
  if (t.length <= 3) return t;
  if (t.endsWith("ing") && t.length > 5) return t.slice(0, -3);
  if (t.endsWith("ed") && t.length > 4) return t.slice(0, -2);
  if (t.endsWith("es") && t.length > 4) return t.slice(0, -2);
  if (t.endsWith("s") && t.length > 3) return t.slice(0, -1);
  return t;
};

const tokenize = (s: string): string[] =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t))
    .map(stem);

/**
 * Match free-text input to a FAQ entry.
 * - Exact id wins immediately.
 * - Exact-question or synonym match wins.
 * - Otherwise: count stemmed tag overlaps with input tokens (min score 2).
 */
export const matchFaq = (input: string, explicitId?: string): FaqEntry | null => {
  if (explicitId) {
    const hit = COACH_FAQ.find((f) => f.id === explicitId);
    if (hit) return hit;
  }
  if (!input) return null;

  const norm = input.trim().toLowerCase();
  const exact = COACH_FAQ.find(
    (f) => f.question.toLowerCase() === norm || (f.synonyms ?? []).some((s) => s.toLowerCase() === norm),
  );
  if (exact) return exact;

  // Substring synonym hit (e.g. user typed "how hard should I lift today?")
  const synHit = COACH_FAQ.find((f) =>
    (f.synonyms ?? []).some((s) => norm.includes(s.toLowerCase())),
  );
  if (synHit) return synHit;

  const tokens = new Set(tokenize(input));
  if (tokens.size === 0) return null;

  let best: { entry: FaqEntry; score: number } | null = null;
  for (const f of COACH_FAQ) {
    const tagSet = new Set(f.tags.map(stem));
    let score = 0;
    for (const t of tagSet) if (tokens.has(t)) score++;
    if (score >= 2 && (!best || score > best.score)) {
      best = { entry: f, score };
    }
  }
  return best?.entry ?? null;
};

/** Deterministic daily rotation for Playbook chips. */
export const dailyPlaybookPicks = (count = 3): FaqEntry[] => {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000,
  );
  return Array.from({ length: count }, (_, i) => COACH_FAQ[(dayOfYear + i) % COACH_FAQ.length]);
};
