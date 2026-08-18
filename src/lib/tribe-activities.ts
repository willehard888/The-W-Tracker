import type { LucideIcon } from "lucide-react";
import {
  Footprints, Dumbbell, PersonStanding, Bike, Waves, Mountain, Swords, Trophy, Flag,
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
      { name: "Tennis", icon: Trophy },
      { name: "Padel", icon: Trophy },
      { name: "Golf", icon: Flag },
      { name: "Climbing", icon: Mountain },
      { name: "Ski", icon: Snowflake },
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

/**
 * Smart defaults per activity, so hosting the right kind of session is one tap.
 * Picking "Workshop" assumes Online + 90 min; "Meditation" → Online + 30 min;
 * a "Hike" → in person + 2 h. These only pre-fill — the host can still override
 * mode/duration, and a manual change is never clobbered by a later pick.
 */
export interface ActivityDefaults {
  /** Suggested meeting mode. */
  mode: "in_person" | "online";
  /** Suggested duration in minutes. */
  duration: number;
  /** Title placeholder tuned to the activity. */
  titleHint: string;
}

const DEFAULTS: Record<string, ActivityDefaults> = {
  // Fitness & Movement — physical, in person, ~1 h.
  Run: { mode: "in_person", duration: 60, titleHint: "Saturday long run" },
  Gym: { mode: "in_person", duration: 60, titleHint: "Leg day session" },
  Yoga: { mode: "in_person", duration: 60, titleHint: "Flow & stretch" },
  Ride: { mode: "in_person", duration: 90, titleHint: "Sunday group ride" },
  Swim: { mode: "in_person", duration: 45, titleHint: "Open-water swim" },
  Hike: { mode: "in_person", duration: 120, titleHint: "Summit hike" },
  Combat: { mode: "in_person", duration: 60, titleHint: "Sparring session" },
  Walk: { mode: "in_person", duration: 45, titleHint: "Morning power walk" },
  // Mind & Wellness — mostly remote-friendly, shorter.
  Meditation: { mode: "online", duration: 30, titleHint: "Morning meditation" },
  Breathwork: { mode: "online", duration: 30, titleHint: "Breathwork circle" },
  "Cold & Sauna": { mode: "in_person", duration: 45, titleHint: "Cold plunge & sauna" },
  Nutrition: { mode: "online", duration: 45, titleHint: "Meal-prep clinic" },
  // Learn & Grow — remote, longer formats.
  Workshop: { mode: "online", duration: 90, titleHint: "Hands-on workshop" },
  Seminar: { mode: "online", duration: 60, titleHint: "Guest seminar" },
  Course: { mode: "online", duration: 60, titleHint: "Live course session" },
  "Book Club": { mode: "in_person", duration: 90, titleHint: "Chapter discussion" },
  Skills: { mode: "online", duration: 60, titleHint: "Skill-share session" },
  // Community.
  Meetup: { mode: "in_person", duration: 60, titleHint: "Community meetup" },
  Accountability: { mode: "online", duration: 30, titleHint: "Weekly check-in" },
};

const FALLBACK_DEFAULTS: ActivityDefaults = {
  mode: "in_person",
  duration: 60,
  titleHint: "Saturday run · Morning meditation · React workshop",
};

/** Smart defaults for an activity (mode, duration, title hint). */
export const activityDefaults = (name?: string | null): ActivityDefaults =>
  (name ? DEFAULTS[name] : undefined) ?? FALLBACK_DEFAULTS;
