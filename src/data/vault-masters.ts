/**
 * The Vault's masters: the thinkers, teachers and scientists behind the Wisdom
 * pieces. Each is a lens, not an authority; `kind` says what sort of claim
 * their work makes so the reader (and the coach) can tell philosophy from
 * psychological theory from evidence. The slug is the `master_slug` column
 * on vault_articles (migration 20260917100001). Content ships via
 * migrations, so this list is as static as code.
 */
export type MasterKind = "philosophy" | "psychology" | "science" | "practice";

export interface VaultMaster {
  slug: string;
  name: string;
  /** Years, or a tradition line for the living. */
  lived: string;
  tradition: string;
  kind: MasterKind;
  /** What this teacher lets you see: one line, present tense. */
  lens: string;
  works: { title: string; year: number }[];
}

export const MASTER_KIND_LABEL: Record<MasterKind, string> = {
  philosophy: "Philosophy",
  psychology: "Psychological theory",
  science: "Science",
  practice: "Practice teacher",
};

export const VAULT_MASTERS: VaultMaster[] = [
  {
    slug: "jung",
    name: "Carl Jung",
    lived: "1875–1961",
    tradition: "Depth psychology",
    kind: "psychology",
    lens: "The parts of you that you do not show run the show anyway.",
    works: [
      { title: "Two Essays on Analytical Psychology", year: 1928 },
      { title: "Aion", year: 1951 },
    ],
  },
  {
    slug: "frankl",
    name: "Viktor Frankl",
    lived: "1905–1997",
    tradition: "Logotherapy",
    kind: "psychology",
    lens: "Meaning is a task you answer, not a feeling you wait for.",
    works: [{ title: "Man's Search for Meaning", year: 1946 }],
  },
  {
    slug: "marcus-aurelius",
    name: "Marcus Aurelius",
    lived: "121–180",
    tradition: "Stoicism",
    kind: "philosophy",
    lens: "Prepare for the difficult before it arrives, then look at it from above.",
    works: [{ title: "Meditations", year: 180 }],
  },
  {
    slug: "epictetus",
    name: "Epictetus",
    lived: "c. 50–135",
    tradition: "Stoicism",
    kind: "philosophy",
    lens: "Sort everything into what is up to you and what never was.",
    works: [
      { title: "Enchiridion", year: 125 },
      { title: "Discourses", year: 108 },
    ],
  },
  {
    slug: "seneca",
    name: "Seneca",
    lived: "c. 4 BC–65",
    tradition: "Stoicism",
    kind: "philosophy",
    lens: "You are not short of time. Look at where it goes.",
    works: [
      { title: "On the Shortness of Life", year: 49 },
      { title: "Letters to Lucilius", year: 65 },
    ],
  },
  {
    slug: "aristotle",
    name: "Aristotle",
    lived: "384–322 BC",
    tradition: "Virtue ethics",
    kind: "philosophy",
    lens: "Character is a habit; you are always building one.",
    works: [{ title: "Nicomachean Ethics", year: -350 }],
  },
  {
    slug: "campbell",
    name: "Joseph Campbell",
    lived: "1904–1987",
    tradition: "Comparative mythology",
    kind: "philosophy",
    lens: "Every change has a call, a refusal, an ordeal and a return.",
    works: [{ title: "The Hero with a Thousand Faces", year: 1949 }],
  },
  {
    slug: "nietzsche",
    name: "Friedrich Nietzsche",
    lived: "1844–1900",
    tradition: "Philosophy",
    kind: "philosophy",
    lens: "Carry the load, refuse it, then choose it: become who you are.",
    works: [
      { title: "Thus Spoke Zarathustra", year: 1883 },
      { title: "Ecce Homo", year: 1908 },
    ],
  },
  {
    slug: "clear",
    name: "James Clear",
    lived: "Behavioural science, writing since 2012",
    tradition: "Habit design",
    kind: "science",
    lens: "Every small action is a vote for the person you are becoming.",
    works: [{ title: "Atomic Habits", year: 2018 }],
  },
  {
    slug: "greene",
    name: "Robert Greene",
    lived: "Strategy and biography, writing since 1998",
    tradition: "Mastery",
    kind: "practice",
    lens: "Nobody skips the apprenticeship; most people quit inside it.",
    works: [{ title: "Mastery", year: 2012 }],
  },
  {
    slug: "goggins",
    name: "David Goggins",
    lived: "Ultra-endurance, writing since 2018",
    tradition: "Discipline",
    kind: "practice",
    lens: "A kept promise to yourself is the smallest unit of self-trust.",
    works: [{ title: "Can't Hurt Me", year: 2018 }],
  },
  {
    slug: "watts",
    name: "Alan Watts",
    lived: "1915–1973",
    tradition: "Zen, Taoism in plain English",
    kind: "philosophy",
    lens: "The grip on security is what makes you sink.",
    works: [{ title: "The Wisdom of Insecurity", year: 1951 }],
  },
  {
    slug: "thich-nhat-hanh",
    name: "Thich Nhat Hanh",
    lived: "1926–2022",
    tradition: "Zen, engaged Buddhism",
    kind: "practice",
    lens: "Do the thing you are doing; the breath is where you come back to.",
    works: [{ title: "The Miracle of Mindfulness", year: 1975 }],
  },
  {
    slug: "kabat-zinn",
    name: "Jon Kabat-Zinn",
    lived: "Mindfulness-based stress reduction since 1979",
    tradition: "MBSR",
    kind: "science",
    lens: "Awareness between the trigger and the reaction is a trainable gap.",
    works: [{ title: "Full Catastrophe Living", year: 1990 }],
  },
  {
    slug: "huberman",
    name: "Andrew Huberman",
    lived: "Neuroscience, Stanford",
    tradition: "Physiology as protocol",
    kind: "science",
    lens: "Light, breath, temperature and dopamine are levers you can pull today.",
    works: [{ title: "Huberman Lab", year: 2021 }],
  },
  {
    slug: "attia",
    name: "Peter Attia",
    lived: "Longevity medicine",
    tradition: "Medicine 3.0",
    kind: "science",
    lens: "Train for the last decade, not the next race.",
    works: [{ title: "Outlive", year: 2023 }],
  },
  {
    slug: "tolle",
    name: "Eckhart Tolle",
    lived: "Teaching since 1997",
    tradition: "Presence",
    kind: "practice",
    lens: "Notice the thinker, and you are already not it.",
    works: [
      { title: "The Power of Now", year: 1997 },
      { title: "A New Earth", year: 2005 },
    ],
  },
  {
    slug: "dispenza",
    name: "Joe Dispenza",
    lived: "Teaching since 2004",
    tradition: "Mental rehearsal",
    kind: "practice",
    lens: "Rehearse the future state with the feeling in it; drop the physics.",
    works: [{ title: "Breaking the Habit of Being Yourself", year: 2012 }],
  },
  {
    slug: "byrne",
    name: "Rhonda Byrne",
    lived: "Writing since 2006",
    tradition: "Awareness",
    kind: "practice",
    lens: "Welcome the feeling instead of fighting it.",
    works: [{ title: "The Greatest Secret", year: 2020 }],
  },
  {
    slug: "sharma",
    name: "Robin Sharma",
    lived: "Writing since 1994",
    tradition: "Leadership",
    kind: "practice",
    lens: "Measure a life on eight scales, not one.",
    works: [{ title: "Wealth Money Can't Buy", year: 2024 }],
  },
];

export const MASTER_BY_SLUG: Record<string, VaultMaster> = Object.fromEntries(
  VAULT_MASTERS.map((m) => [m.slug, m]),
);
