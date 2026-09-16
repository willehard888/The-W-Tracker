/**
 * Paths: sequences of Vault pieces around one transformation, one per
 * dimension of a life. A path is a suggested order; the next step is always
 * the first piece not yet practised. Step slugs are vault_articles.slug and
 * are checked against the content migrations by vault-map.test.ts.
 */
export type VaultDimension = "body" | "mind" | "discipline" | "character" | "purpose" | "mastery";

export interface VaultPath {
  slug: string;
  dimension: VaultDimension;
  title: string;
  /** One sentence: the change this path works on. */
  thesis: string;
  /** Article slugs in walking order. */
  steps: string[];
  /** Verb per step, same length as `steps`: the stage a walker is in. */
  beats: string[];
}

export const DIMENSION_LABEL: Record<VaultDimension, string> = {
  body: "Body",
  mind: "Mind",
  discipline: "Discipline",
  character: "Character",
  purpose: "Purpose",
  mastery: "Mastery",
};

export const VAULT_PATHS: VaultPath[] = [
  {
    slug: "shadow",
    dimension: "character",
    title: "The Shadow Path",
    thesis: "Use what irritates you as a map, catch the role deciding for you, and stop fighting what you feel.",
    steps: [
      "jung-shadow-individuation",
      "jung-persona-mask",
      "new-earth-ego",
      "greatest-secret-awareness",
      "watts-wisdom-of-insecurity",
    ],
    beats: ["Notice", "Name", "Catch", "Accept", "Let go"],
  },
  {
    slug: "stoic",
    dimension: "mastery",
    title: "The Stoic Path",
    thesis: "Sort what is yours, prepare for the difficult, reclaim your hours, then serve the apprenticeship.",
    steps: [
      "epictetus-dichotomy-of-control",
      "marcus-aurelius-morning-practice",
      "seneca-on-time",
      "greene-mastery-apprenticeship",
    ],
    beats: ["Sort", "Prepare", "Reclaim", "Apprentice"],
  },
  {
    slug: "meaning",
    dimension: "purpose",
    title: "The Meaning Path",
    thesis: "Answer what life is asking, name the stage of your change, choose your load, and widen the scorecard.",
    steps: [
      "frankl-meaning-responsibility",
      "campbell-heros-journey",
      "nietzsche-self-overcoming",
      "eight-forms-of-wealth",
    ],
    beats: ["Answer", "Locate", "Choose", "Widen"],
  },
  {
    slug: "discipline",
    dimension: "discipline",
    title: "The Discipline Path",
    thesis: "Cast votes for who you are, keep small promises on hard days, and let a trait become a habit.",
    steps: ["atomic-habits-identity", "goggins-callused-mind", "aristotle-habituation"],
    beats: ["Vote", "Promise", "Repeat"],
  },
  {
    slug: "presence",
    dimension: "mind",
    title: "The Presence Path",
    thesis: "Step out of the thought loop, do one thing fully, and train the body you read every day.",
    steps: ["power-of-now-presence", "thich-nhat-hanh-one-thing", "kabat-zinn-full-catastrophe"],
    beats: ["Return", "Do", "Scan"],
  },
  {
    slug: "long-game",
    dimension: "body",
    title: "The Long Game",
    thesis: "Pull the cheapest physiological levers, then train for the decade you want at ninety.",
    steps: ["huberman-protocol-stack", "attia-centenarian-decathlon"],
    beats: ["Lever", "Back-calculate"],
  },
];

export const PATH_BY_SLUG: Record<string, VaultPath> = Object.fromEntries(
  VAULT_PATHS.map((p) => [p.slug, p]),
);

/** The path a piece belongs to, if any (a slug appears in at most one path). */
export const pathOfArticle = (slug: string): VaultPath | undefined =>
  VAULT_PATHS.find((p) => p.steps.includes(slug));
