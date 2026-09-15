/**
 * Daily Vault insights — one surfaces on Home per day (see
 * DailyInsightCard + pickDaily). Each deep-links to its Vault lesson via
 * /vault?lesson=<slug>. Three courses feed the pool: Inner Work (attention,
 * identity, state), Longevity (healthspan, the five levers) and Wisdom (the
 * great books and teachers, in our own words, never a quoted line). Tone
 * matches the courses: honest-premium, evidence-first, no woo claims.
 */
export interface DailyInsight {
  id: string;
  text: string;
  lessonSlug: string;
}

export const DAILY_INSIGHTS: DailyInsight[] = [
  // 1 · The Inner Operating System
  { id: "os-1", text: "Willpower is an override. Identity is the operating system. Train both — only one of them lasts a decade.", lessonSlug: "inner-operating-system" },
  { id: "os-2", text: "You don't experience the world. You experience what you attend to — and attention is trainable.", lessonSlug: "inner-operating-system" },
  { id: "os-3", text: "The same task is easy at 90% and impossible at 40%. State first, task second.", lessonSlug: "inner-operating-system" },
  { id: "os-4", text: "Habits leak through three holes: identity, attention, state. Find your leak.", lessonSlug: "inner-operating-system" },

  // 2 · Manifestation, Demystified
  { id: "mani-1", text: "You don't attract what you want. You notice what you're primed to see. Prime deliberately.", lessonSlug: "manifestation-demystified" },
  { id: "mani-2", text: "Write the vision every morning — then take one action the person who has it would take. Today. That's the whole law.", lessonSlug: "manifestation-demystified" },
  { id: "mani-3", text: "Research is blunt: dreaming as if it's done drains the drive to do it. Vision without action is sedation.", lessonSlug: "manifestation-demystified" },
  { id: "mani-4", text: "People who expect good outcomes take more shots. More shots, more hits. That's not the universe — that's you.", lessonSlug: "manifestation-demystified" },
  { id: "mani-5", text: "A vivid goal turns your attention into a filter that catches openings you used to walk past.", lessonSlug: "manifestation-demystified" },

  // 3 · WOOP
  { id: "woop-1", text: "Dream it fully. Then find the feeling that derails you — and pre-load your answer. That's WOOP.", lessonSlug: "woop-mental-contrasting" },
  { id: "woop-2", text: "IF it's 18:00 and I feel drained, THEN shoes on, door, go. Decisions made in advance don't need willpower.", lessonSlug: "woop-mental-contrasting" },
  { id: "woop-3", text: "The obstacle is never your schedule. It's the feeling that negotiates with you. Plan against the feeling.", lessonSlug: "woop-mental-contrasting" },
  { id: "woop-4", text: "Five minutes of Wish–Outcome–Obstacle–Plan outperforms an hour of motivation. Run one on today's hardest thing.", lessonSlug: "woop-mental-contrasting" },

  // 4 · Visualization
  { id: "vis-1", text: "Visualise the work, not the podium. Rehearsing the reward relaxes the drive to earn it.", lessonSlug: "visualization-that-works" },
  { id: "vis-2", text: "The most valuable image: the moment it gets hard — and you executing anyway. Rehearse that.", lessonSlug: "visualization-that-works" },
  { id: "vis-3", text: "First person, real time, your actual gym. Vague imagery does nothing; vivid rehearsal transfers.", lessonSlug: "visualization-that-works" },
  { id: "vis-4", text: "Three minutes of process imagery before the session is the cheapest performance enhancer you own.", lessonSlug: "visualization-that-works" },

  // 5 · Elevate Your Energy
  { id: "energy-1", text: "\"Raise your energy\" — honestly: breath, posture, movement, light, meaning. Five levers, all yours.", lessonSlug: "elevate-your-energy" },
  { id: "energy-2", text: "Double inhale, long exhale. Five times. Faster than caffeine, and it's already in you.", lessonSlug: "elevate-your-energy" },
  { id: "energy-3", text: "Audit your week like an accountant: chargers up, drains out. Energy is a ledger, not a mystery.", lessonSlug: "elevate-your-energy" },
  { id: "energy-4", text: "Emotion follows motion. Two minutes of movement beats twenty minutes of trying to feel like it.", lessonSlug: "elevate-your-energy" },
  { id: "energy-5", text: "You can't always choose the circumstances. You can almost always choose the state you enter them in.", lessonSlug: "elevate-your-energy" },

  // 6 · Gratitude & Savoring
  { id: "grat-1", text: "Your brain flags problems by default. Gratitude is manually correcting the filter — three specifics, tonight.", lessonSlug: "gratitude-savoring" },
  { id: "grat-2", text: "Don't just pass the good moment. Stop for 30 seconds and let it register. That's savoring — live gratitude.", lessonSlug: "gratitude-savoring" },
  { id: "grat-3", text: "The biggest measured gratitude effect: telling the person. One concrete thank-you this week.", lessonSlug: "gratitude-savoring" },
  { id: "grat-4", text: "\"Training went well\" trains nothing. \"I showed up drained because the plan was pre-loaded\" — that rewires the filter.", lessonSlug: "gratitude-savoring" },

  // 7 · Distanced Self-Talk
  { id: "talk-1", text: "You're wiser about your friends' problems than your own. Use your name, and become your own friend.", lessonSlug: "distanced-self-talk" },
  { id: "talk-2", text: "The critic and the coach hold the same standard. Only one of them gets results. Rewrite the voice.", lessonSlug: "distanced-self-talk" },
  { id: "talk-3", text: "Spiralling? Ask: how will this look in a year? Distance shrinks what's gripping you.", lessonSlug: "distanced-self-talk" },
  { id: "talk-4", text: "Before the hard set, one instruction, by name: \"First rep. Nothing else.\" Coach yourself from outside.", lessonSlug: "distanced-self-talk" },

  // 8 · Authentic Self-Image
  { id: "self-1", text: "Every action is a vote for someone. Today's check-in isn't points — it's evidence of who you are.", lessonSlug: "authentic-self-image" },
  { id: "self-2", text: "Authentic doesn't mean fixed. It means your actions match values YOU chose. You're allowed to build the self.", lessonSlug: "authentic-self-image" },
  { id: "self-3", text: "Audit the goal before you chase it: is it yours, or borrowed from a feed? Borrowed goals drain deepest.", lessonSlug: "authentic-self-image" },
  { id: "self-4", text: "A vague \"be better\" organises nothing. A vivid \"who I'm becoming\" directs every choice today.", lessonSlug: "authentic-self-image" },
  { id: "self-5", text: "Identity that outruns evidence collapses. Identity that grows with evidence becomes unshakeable. Vote daily.", lessonSlug: "authentic-self-image" },

  // 9 · Letting Go
  { id: "letgo-1", text: "Try not to think of a white bear. That's why fighting the thought feeds it. Make room instead.", lessonSlug: "letting-go" },
  { id: "letgo-2", text: "\"I can't do this\" → \"I'm having the thought that I can't do this.\" Thoughts are events, not orders.", lessonSlug: "letting-go" },
  { id: "letgo-3", text: "Two columns: yours, not yours. Full effort on the first. One exhale for the second.", lessonSlug: "letting-go" },
  { id: "letgo-4", text: "Carrying the day to bed is a sleep tax. Name it, sort it, one action for tomorrow — day closed.", lessonSlug: "letting-go" },
  { id: "letgo-5", text: "Maximum agency, minimum grip: all-in on the action, open hands on the outcome.", lessonSlug: "letting-go" },

  // 10 · Recap
  { id: "recap-1", text: "Prime attention. Build identity. Manage state. Release the rest. Fifteen minutes a day — that's the whole system.", lessonSlug: "inner-work-recap" },
  { id: "recap-2", text: "Tools that aren't scheduled don't compound. Put the morning prime and evening release on the clock.", lessonSlug: "inner-work-recap" },

  // ══ Longevity: The 100-Year Athlete ══

  // L1 · Healthspan vs Lifespan
  { id: "lon-hs-1", text: "The goal isn't more years. It's more years you'd actually want — capable, mobile, yours.", lessonSlug: "healthspan-vs-lifespan" },
  { id: "lon-hs-2", text: "Whatever you want to do in your last decade, you can only do if you trained for it. Plan backwards.", lessonSlug: "healthspan-vs-lifespan" },
  { id: "lon-hs-3", text: "Two people die at 88. One declined for 20 years, one hiked at 80. Same lifespan — train for the second life.", lessonSlug: "healthspan-vs-lifespan" },

  // L2 · Hierarchy of levers
  { id: "lon-lev-1", text: "Five basics predict 12–14 extra years at 50. No supplement comes within an order of magnitude. The basics ARE the biohack.", lessonSlug: "hierarchy-of-longevity-levers" },
  { id: "lon-lev-2", text: "Before any longevity hack, one question: which lever does it pull — fitness, strength, sleep, metabolic, connection?", lessonSlug: "hierarchy-of-longevity-levers" },
  { id: "lon-lev-3", text: "Low fitness rivals smoking as a mortality risk. Today's session is the most serious medicine you'll take.", lessonSlug: "hierarchy-of-longevity-levers" },

  // L3 · VO2max
  { id: "lon-vo2-1", text: "Every 1-MET gain in fitness ≈ 13% lower all-cause mortality. The treadmill is a longevity device.", lessonSlug: "vo2max-strongest-predictor" },
  { id: "lon-vo2-2", text: "Stairs cost the same oxygen at 85 as at 35. VO₂max decides whether they're trivial or impossible. Build altitude now.", lessonSlug: "vo2max-strongest-predictor" },
  { id: "lon-vo2-3", text: "One 4×4 interval session a week — 4 min hard, 3 easy, ×4. That's the whole VO₂max entry fee.", lessonSlug: "vo2max-strongest-predictor" },

  // L4 · Strength
  { id: "lon-str-1", text: "Grip strength out-predicts blood pressure for mortality. Muscle is the retirement account — today's session is a deposit.", lessonSlug: "strength-longevity-organ" },
  { id: "lon-str-2", text: "30–60 minutes of strength work a week associates with 10–17% lower mortality. Two sessions. That's the dose.", lessonSlug: "strength-longevity-organ" },
  { id: "lon-str-3", text: "90-year-olds still build strength in trials. The machinery never closes — but the rebuild costs more every decade you wait.", lessonSlug: "strength-longevity-organ" },

  // L5 · Protein
  { id: "lon-pro-1", text: "Aging muscle goes deaf to protein — the same intake quietly stops working. 1.6–2.2 g/kg, spread over the day.", lessonSlug: "protein-aging-athlete" },
  { id: "lon-pro-2", text: "A 10 g breakfast never triggers muscle building. Anchor every meal on protein first — 30 g is the floor.", lessonSlug: "protein-aging-athlete" },

  // L6 · Sleep
  { id: "lon-slp-1", text: "Under 6 hours tracks with 12% higher mortality and more dementia decades later. Tonight's window is a longevity rep.", lessonSlug: "sleep-repair-budget" },
  { id: "lon-slp-2", text: "You can't control sleep — only the window you give it. Fixed wake time, 8-hour opportunity, caffeine curfew.", lessonSlug: "sleep-repair-budget" },

  // L7 · Metabolic health
  { id: "lon-met-1", text: "Keep your waist under half your height — a tape measure out-screens BMI for the diseases that end healthspan.", lessonSlug: "metabolic-health-waistline" },
  { id: "lon-met-2", text: "Ten minutes of walking after dinner pulls glucose into muscle with barely any insulin. Best return-per-minute in health.", lessonSlug: "metabolic-health-waistline" },

  // L8 · Connection & purpose
  { id: "lon-con-1", text: "Isolation carries mortality risk in smoking's class. Your tribe session is a longevity protocol, not a social extra.", lessonSlug: "connection-purpose-longevity" },
  { id: "lon-con-2", text: "People with a clear reason to get up died at half the rate over 5 years. Name yours in one sentence.", lessonSlug: "connection-purpose-longevity" },

  // L9 · Supplement graveyard
  { id: "lon-sup-1", text: "Resveratrol: 9 years of human data, zero association with living longer. The mice were interesting. You're not a mouse.", lessonSlug: "supplement-graveyard" },
  { id: "lon-sup-2", text: "Three questions kill most longevity products: human outcomes? which lever? who profits if I believe?", lessonSlug: "supplement-graveyard" },

  // L10 · Recap
  { id: "lon-os-1", text: "The last decade of your life is being negotiated this decade — in ordinary weeks like this one. Run the week.", lessonSlug: "hundred-year-operating-system" },
  { id: "lon-os-2", text: "Bad weeks shrink the system, never stop it. One lift, one walk, protein, sleep — the floor keeps the identity alive.", lessonSlug: "hundred-year-operating-system" },

  // ── Wisdom · the great books and teachers (20260916090001)
  { id: "wis-read-1", text: "Read a teacher for the practice you can run on Tuesday. The worldview can wait.", lessonSlug: "how-to-read-a-teacher" },
  { id: "wis-read-2", text: "Speculative is not an insult. It means keep the exercise, drop the explanation.", lessonSlug: "how-to-read-a-teacher" },
  { id: "wis-atomic-1", text: "You don't need a unanimous election. Every small action is a vote for who you are. Win the majority.", lessonSlug: "atomic-habits-identity" },
  { id: "wis-atomic-2", text: "Design the room and you stop needing the willpower. Then never miss twice.", lessonSlug: "atomic-habits-identity" },
  { id: "wis-now-1", text: "The moment you watch a thought, you are no longer inside it. That half-step is the whole practice.", lessonSlug: "power-of-now-presence" },
  { id: "wis-now-2", text: "The situation right now is usually fine. The story about tomorrow is what hurts.", lessonSlug: "power-of-now-presence" },
  { id: "wis-ego-1", text: "Ego is the mind saying “I am” to things that can be lost. Catch it once a day, in the act.", lessonSlug: "new-earth-ego" },
  { id: "wis-ego-2", text: "Do you want to be right, or do you want it fixed? The ego only ever picks one.", lessonSlug: "new-earth-ego" },
  { id: "wis-aware-1", text: "A feeling that is allowed passes in minutes. A feeling that is fought can last for days.", lessonSlug: "greatest-secret-awareness" },
  { id: "wis-aware-2", text: "Am I aware? The answer arrived before any thought did. Two seconds, back in the room.", lessonSlug: "greatest-secret-awareness" },
  { id: "wis-wealth-1", text: "Money at five, family at one. That is not wealth, whatever the number says.", lessonSlug: "eight-forms-of-wealth" },
  { id: "wis-wealth-2", text: "Score eight forms, not one. Then work on the lowest, because the lowest sets how rich life feels.", lessonSlug: "eight-forms-of-wealth" },
  { id: "wis-jung-1", text: "Whoever irritates you out of proportion is showing you a page from your own shadow.", lessonSlug: "jung-shadow-individuation" },
  { id: "wis-jung-2", text: "What you refuse does not vanish. It leaks, at the worst possible moment.", lessonSlug: "jung-shadow-individuation" },
  { id: "wis-rehearse-1", text: "Rehearse the next set from the inside, including the moment it gets hard. Then go lift it.", lessonSlug: "dispenza-rehearsal" },
  { id: "wis-rehearse-2", text: "Every morning you rehearse the same self. Ten minutes a day, rehearse another one.", lessonSlug: "dispenza-rehearsal" },
  { id: "wis-huber-1", text: "Ten minutes of morning light sets the clock your whole day, and your sleep, runs on.", lessonSlug: "huberman-protocol-stack" },
  { id: "wis-huber-2", text: "Two inhales, one long exhale. The fastest evidenced way to bring the day back down.", lessonSlug: "huberman-protocol-stack" },
  { id: "wis-watts-1", text: "Thrash and you sink. Relax and you float. Reaching for calm is what keeps it away.", lessonSlug: "watts-wisdom-of-insecurity" },
  { id: "wis-watts-2", text: "Nobody plays a symphony to reach the final chord. Train like the playing is the point.", lessonSlug: "watts-wisdom-of-insecurity" },
  { id: "wis-stack-1", text: "Nine teachers, one week, under twenty minutes a day. Believe none of it. Run all of it.", lessonSlug: "wisdom-practice-stack" },
  { id: "wis-stack-2", text: "A course is finished when it changes a week, not when the last lesson is marked complete.", lessonSlug: "wisdom-practice-stack" },
];
