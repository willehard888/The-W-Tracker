import type { LucideIcon } from "lucide-react";
import {
  Footprints, Dumbbell, PersonStanding, Bike, Waves, Mountain, Swords,
  Flower2, Wind, Snowflake, Salad,
  Hammer, Presentation, GraduationCap, BookOpen, Lightbulb,
  Users, Target, Sparkles,
} from "lucide-react";

/**
 * The single source of truth for what a tribe can be about.
 *
 * Tribes started as sports/fitness only, but a tribe is really any group that
 * holds each other accountable — so the catalogue spans movement, inner work,
 * learning, and community. Grouped so the create/browse UIs can render tidy
 * sections instead of one long undifferentiated wall of pills.
 *
 * Stored values are the plain `name` strings (DB columns are free-text), so
 * adding categories here never breaks existing tribes/events.
 */
export interface TribeActivity {
  name: string;
  icon: LucideIcon;
}

export interface TribeActivityGroup {
  label: string;
  items: TribeActivity[];
}

export const TRIBE_ACTIVITY_GROUPS: TribeActivityGroup[] = [
  {
    label: "Fitness & Movement",
    items: [
      { name: "Run", icon: Footprints },
      { name: "Gym", icon: Dumbbell },
      { name: "Yoga", icon: PersonStanding },
      { name: "Ride", icon: Bike },
      { name: "Swim", icon: Waves },
      { name: "Hike", icon: Mountain },
      { name: "Combat", icon: Swords },
      { name: "Walk", icon: Footprints },
    ],
  },
  {
    label: "Mind & Wellness",
    items: [
      { name: "Meditation", icon: Flower2 },
      { name: "Breathwork", icon: Wind },
      { name: "Cold & Sauna", icon: Snowflake },
      { name: "Nutrition", icon: Salad },
    ],
  },
  {
    label: "Learn & Grow",
    items: [
      { name: "Workshop", icon: Hammer },
      { name: "Seminar", icon: Presentation },
      { name: "Course", icon: GraduationCap },
      { name: "Book Club", icon: BookOpen },
      { name: "Skills", icon: Lightbulb },
    ],
  },
  {
    label: "Community",
    items: [
      { name: "Meetup", icon: Users },
      { name: "Accountability", icon: Target },
      { name: "Other", icon: Sparkles },
    ],
  },
];

/** Flat list of every activity name — for simple selectors and filters. */
export const TRIBE_ACTIVITIES: string[] = TRIBE_ACTIVITY_GROUPS.flatMap((g) =>
  g.items.map((i) => i.name),
);

const ICON_BY_NAME: Record<string, LucideIcon> = Object.fromEntries(
  TRIBE_ACTIVITY_GROUPS.flatMap((g) => g.items.map((i) => [i.name, i.icon])),
);

/** Resolve an activity name to its icon, falling back to a neutral sparkle. */
export const activityIcon = (name?: string | null): LucideIcon =>
  (name ? ICON_BY_NAME[name] : undefined) ?? Sparkles;
