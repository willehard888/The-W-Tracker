import { Utensils, Dumbbell, Moon, Brain, Wind as WindIcon, Sparkles, Hourglass, BookOpen } from "lucide-react";
import type { VaultDimension } from "@/data/vault-paths";

/**
 * The Vault's shelves, in shelf order, and the one place their accents live.
 * An accent is identity (cover, lesson number, section marks), never an
 * action colour: buttons are the app's buttons on every shelf.
 */
export interface VaultCategory {
  id: string;
  title: string;
  tagline: string;
  description: string;
  icon: typeof Utensils;
  accent: string;
}

export const CATEGORIES: VaultCategory[] = [
  {
    id: "wisdom",
    title: "Wisdom",
    tagline: "Twenty-one thinkers, one loop",
    description:
      "The ideas that changed how people live, each with a private reflection, a short practice and a question afterwards. The nine-source course, then Frankl, the Stoics, Aristotle, Campbell, Nietzsche, Greene, Goggins, Thich Nhat Hanh, Kabat-Zinn, Attia, Robbins and two Jung pieces. The chip rates the practice, never the worldview.",
    icon: BookOpen,
    accent: "hsl(350 60% 64%)",
  },
  {
    id: "inner-work",
    title: "Inner Work",
    tagline: "Identity, energy, self-talk",
    description:
      "The honest version of manifestation, energy and self-image work: what research supports (mental contrasting, imagery, self-talk), what is speculative, and how to use both to become who you are training to be.",
    icon: Sparkles,
    accent: "hsl(45 90% 58%)",
  },
  {
    id: "longevity",
    title: "Longevity",
    tagline: "Healthspan, the long game",
    description:
      "The 100-Year Athlete: healthspan over lifespan, ranked by mortality evidence. Aerobic fitness, strength, protein, sleep, metabolic health and connection, with an honest walk through the supplement graveyard.",
    icon: Hourglass,
    accent: "hsl(168 70% 45%)",
  },
  {
    id: "recovery",
    title: "Recovery and Sleep",
    tagline: "Sleep, light, cold, heat",
    description:
      "What recovery is made of: the sleep window, the morning light that times it, the caffeine cut-off that protects it, and cold and heat used at the right hour.",
    icon: Moon,
    accent: "hsl(220 80% 65%)",
  },
  {
    id: "training",
    title: "Strength and Conditioning",
    tagline: "Lifts, zone 2, VO₂max",
    description:
      "Programming principles that hold across decades of research: progressive overload, a zone 2 base, the 4×4 interval, planned deloads, the daily step floor and eight minutes of mobility.",
    icon: Dumbbell,
    accent: "hsl(var(--ember))",
  },
  {
    id: "mind",
    title: "Mind and Emotional Skill",
    tagline: "Breath, reframing, focus",
    description:
      "Practical, well-evidenced tools for the mind: the physiological sigh, box breathing, mindfulness, cognitive reframing, deep work and a five-minute journal.",
    icon: Brain,
    accent: "hsl(280 70% 65%)",
  },
  {
    id: "nervous-system",
    title: "Nervous System",
    tagline: "Polyvagal, NSDR, HRV",
    description:
      "Down-regulate a nervous system that runs hot: the polyvagal map, NSDR, coherent breathing at the resonance frequency, the dive reflex, and four self-hypnosis scripts.",
    icon: WindIcon,
    accent: "hsl(190 80% 60%)",
  },
  {
    id: "recipes",
    title: "Nutrition",
    tagline: "Protein, fuel, timing",
    description:
      "Evidence-led performance nutrition: protein dosing, fuelling around training, the Mediterranean pattern, caffeine timing, hydration and the gut. The meal-prep recipes live one row down.",
    icon: Utensils,
    accent: "hsl(152 68% 50%)",
  },
];

const FALLBACK_ACCENT = "hsl(var(--gold))";

export const accentOf = (categoryId: string | null | undefined): string =>
  CATEGORIES.find((c) => c.id === categoryId)?.accent ?? FALLBACK_ACCENT;

export const WISDOM_ACCENT = accentOf("wisdom");

/** Each dimension borrows the accent of the shelf it is closest to; gold stays the hero's. */
export const DIMENSION_ACCENT: Record<VaultDimension, string> = {
  body: accentOf("longevity"),
  mind: accentOf("mind"),
  discipline: accentOf("training"),
  character: WISDOM_ACCENT,
  purpose: accentOf("recovery"),
  mastery: accentOf("nervous-system"),
};
