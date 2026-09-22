import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { markUrl, badgeSlug } from "@/lib/marks";
import { TIER_ORDER } from "@/lib/status-tiers";
import { CHECKIN_HABITS } from "@/lib/checkin-habits";
import { SPORTS } from "@/lib/sports";
import { ALL_QUESTS } from "@/components/DailyQuests";
import { PILLARS } from "@/lib/wellness-framework";
import { GOAL_OPTIONS, STRUGGLE_OPTIONS, FREQUENCY_OPTIONS } from "@/lib/onboarding";
import { BADGE_MILESTONES } from "@/lib/referral-rewards";

/**
 * Every id the app can put on screen has its drawn mark under public/marks.
 * A new habit, sport or quest without one is a broken image in a list — add
 * its subject to scripts/marks-catalog.mjs and run `mark-art.mjs gen`.
 */
const missing = (urls: string[]) => urls.filter((u) => !existsSync(`public${u}`));

// badges.name is the key (the DB has no slug column). This is the live table
// on 2026-09-22 — 129 rows; the migrations seed only 42 of them, so the list
// lives here. A badge added later shows its emoji until it is drawn
// (scripts/marks-catalog.mjs, then `mark-art.mjs gen badge`).
const BADGES = [
  "10 Check-ins", "100 Check-ins", "100-Day Legend", "100K Legend", "10K Club", "200 Workouts", "30-Day Streak",
  "50 Check-ins", "500 Check-ins", "60-Day Dynasty", "90-Day Streak", "Absolute Zero", "Apex Reached", "Apex Stronghold",
  "Apprentice", "Arctic Soul", "Army Builder", "Battle God", "Battle Hardened", "Beast Mode", "Bookworm", "Brand Ambassador",
  "Champion", "Champion Fighter", "Clean Eater", "Cold Warrior", "Commentator", "Consistent", "Devoted", "Diet King",
  "Digital Ascetic", "Discipline Builder", "Double Down", "Double Trouble", "Early Riser", "Enlightened", "Eternal",
  "Eternal Legend", "Eternal Pyre", "First 1K", "First Blood", "First Breath", "First Chapter", "First Chill",
  "First Clean Meal", "First Recruit", "First Spark", "First Step", "First Sweat", "First Tribe Blood", "Flawless",
  "Fortnight Force", "Founder", "Founders Circle", "Founding Apex", "Frost King", "Gladiator", "Grandmaster", "Gym Rat",
  "Gym Regular", "Hydration King", "Ice Breaker", "Inferno Personal", "Influencer", "Inner Circle Founder", "Inner Peace",
  "Integrator", "Iron Mind", "Kingmaker", "Knowledge Seeker", "Kudos Master", "Legend Ascendant", "Level 15", "Level 30",
  "Level 5", "Library Legend", "Mastery Builder", "Meaning Seeker", "Mind Over Matter", "Morning Monk", "Night Guardian",
  "Night Owl Discipline", "Nutrition Nerd", "Ocean Inside", "One of the Winners", "Overachiever", "Perfect Week",
  "Perfectionist", "Phoenix", "Polar Bear", "Proof Machine", "Protein Beast", "Protein Machine", "Protein Titan",
  "Receipts Only", "Recruiter", "Rising Star", "Scholar", "Season Champion", "Shadow Explorer", "Show Don't Tell",
  "Spark Brother", "Spring 26", "Squad Leader", "Stoic Path", "Sunset Sage", "Titan of Iron", "Top 1%", "Top 10%",
  "Top 5%", "Tribe Conqueror", "Tribe Ember", "Tribe Founder", "Tribe Inferno", "Undefeated", "Unstoppable", "Viral",
  "War Chief", "Warlord", "Warrior", "Water God", "Wayfinder", "Week Warrior", "XP Collector", "XP Immortal",
  "XP Machine", "XP Overlord", "Year of Steel", "Zen Master",
];

describe("marks", () => {
  it("slugs badge names the way the files are named", () => {
    expect(badgeSlug("7-Day Streak")).toBe("7-day-streak");
    expect(badgeSlug("Top 10 Percent")).toBe("top-10-percent");
    expect(markUrl("tier", "normal")).toBe("/marks/tier/recruit.webp");
  });

  it("every tier has a mark", () => {
    expect(missing(TIER_ORDER.map((t) => markUrl("tier", t)))).toEqual([]);
  });
  it("every badge has a mark", () => {
    expect(missing(BADGES.map((b) => markUrl("badge", b)))).toEqual([]);
    expect(missing(BADGE_MILESTONES.map((m) => markUrl("badge", m.badge)))).toEqual([]);
  });
  it("every check-in habit, sport, quest and pillar has a mark", () => {
    expect(missing(CHECKIN_HABITS.map((h) => markUrl("habit", h.key)))).toEqual([]);
    expect(missing(SPORTS.filter((s) => s.id !== "none").map((s) => markUrl("sport", s.id)))).toEqual([]);
    expect(missing(ALL_QUESTS.map((q) => markUrl("quest", q.id)))).toEqual([]);
    expect(missing(Object.keys(PILLARS).map((p) => markUrl("pillar", p)))).toEqual([]);
  });
  it("every onboarding option and mood step has a mark", () => {
    const options = [...GOAL_OPTIONS, ...STRUGGLE_OPTIONS, ...FREQUENCY_OPTIONS];
    expect(options.every((o) => o.mark)).toBe(true);
    expect(missing(options.map((o) => markUrl(o.markFamily ?? "onboarding", o.mark!)))).toEqual([]);
    const mood = [1, 2, 3, 4, 5].flatMap((n) => [markUrl("mood", `energy-${n}`), markUrl("mood", `mood-${n}`)]);
    expect(missing(mood)).toEqual([]);
  });
});
