// Curated W Coach FAQ playbook — instant, premium answers (no network call).
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
];

const STOP = new Set([
  "the","a","an","is","are","do","i","my","me","you","your","to","of","on","in","for","and","or","with","what","how","when","should","much","need","at","be","it","this","that","if","not","no","yes","can","get","got","really","actually","still",
]);

const tokenize = (s: string): string[] =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t));

/**
 * Match free-text input to a FAQ entry.
 * - Exact id match wins immediately.
 * - Otherwise: count tag overlaps with input tokens.
 * - Threshold: at least 2 hits (avoids false positives on short generic phrases).
 */
export const matchFaq = (input: string, explicitId?: string): FaqEntry | null => {
  if (explicitId) {
    const hit = COACH_FAQ.find((f) => f.id === explicitId);
    if (hit) return hit;
  }
  if (!input) return null;

  // Exact-question match (chip taps that sent the question text)
  const norm = input.trim().toLowerCase();
  const exact = COACH_FAQ.find((f) => f.question.toLowerCase() === norm);
  if (exact) return exact;

  const tokens = tokenize(input);
  if (tokens.length === 0) return null;

  let best: { entry: FaqEntry; score: number } | null = null;
  for (const f of COACH_FAQ) {
    const score = f.tags.reduce((s, t) => (tokens.includes(t) ? s + 1 : s), 0);
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
