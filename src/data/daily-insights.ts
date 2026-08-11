/**
 * Daily Inner Work insights — one surfaces on Home per day (see
 * DailyInsightCard + pickDaily). Each deep-links to its Vault lesson via
 * /vault?lesson=<slug>. Tone matches the course: honest-premium, no woo
 * claims — mechanisms you own (attention, identity, state), not magic.
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
];
