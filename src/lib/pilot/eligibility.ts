// May we ask anything right now, and if so, what?
//
// One pure function, because this is the rule the brief cares most about and a
// rule that can only be checked by using the app for two weeks is a rule nobody
// checks. Everything it needs is an argument; it reads no clock, no storage and
// no network.
//
// THE BUDGET
//
//   • at most ONE question per app launch
//   • never in the same launch as an onboarding teaching card
//   • at least 48 h between two contextual questions
//   • never a question about a feature this person has not used
//   • never the same question twice, ever, on any device
//
// This is deliberately stricter than the onboarding system's own pacing
// (SESSION_SHOW_CAP = 2 per launch). Teaching cards are the app explaining
// itself, which a new member wants; questions are us interrupting to ask for
// something, and the whole point of the pilot is to watch natural behaviour:
// "Älä rakenna palautekyselyitä niin aggressiivisesti, että ne häiritsevät
// sovelluksen normaalia käyttöä."

import { PILOT_PROMPTS, type PilotPrompt, type PilotSignals } from "./prompts";

/** At most this many trigger-initiated questions per app launch. */
export const LAUNCH_CAP = 1;

/** Minimum gap between two CONTEXTUAL questions. */
export const COOLDOWN_MS = 48 * 60 * 60 * 1000;

export interface PromptLogEntry {
  shownAt: number | null;
  answeredAt: number | null;
  dismissedAt: number | null;
}

/** prompt_id → what has happened to it. Mirrors pilot_prompt_log. */
export type PromptLog = Record<string, PromptLogEntry>;

export interface EligibilityInput {
  isPilot: boolean;
  inWindow: boolean;
  day: number;
  signals: PilotSignals;
  log: PromptLog;
  /** Questions already shown this app launch. */
  shownThisLaunch: number;
  /** True once an onboarding teaching card has been shown this launch. */
  teachingCardShown: boolean;
  now: number;
}

/**
 * Asked at all — shown, answered or dismissed.
 *
 * A dismissal counts. Somebody who swiped the question away has answered the
 * only question that matters about it, and asking again would be the app not
 * listening.
 */
const alreadyAsked = (log: PromptLog, id: string): boolean => {
  const e = log[id];
  return !!e && (e.shownAt != null || e.answeredAt != null || e.dismissedAt != null);
};

/** When any question was last put in front of this person. */
const lastShownAt = (log: PromptLog): number =>
  Object.values(log).reduce((max, e) => Math.max(max, e.shownAt ?? 0), 0);

/**
 * The next question to ask, or null — which is the answer most of the time and
 * is supposed to be.
 *
 * Checkpoints outrank contextual questions and bypass the 48 h cooldown: they
 * are the scheduled, agreed part of the pilot, and a tester who was asked
 * something on Tuesday still gets the day-7 checkpoint on Wednesday. They still
 * respect the launch cap and still never appear beside a teaching card.
 *
 * A checkpoint that comes due while the app is closed does not expire — it is
 * asked on the next launch. Day 7's question is still worth asking on day 8;
 * `pilot_day` is stamped server-side, so the answer records when it was really
 * given.
 */
export const nextPrompt = (input: EligibilityInput): PilotPrompt | null => {
  const { isPilot, inWindow, day, signals, log, shownThisLaunch, teachingCardShown, now } = input;

  // Not a tester, or the window has closed. Access outlives the window, so this
  // is the ordinary state for most people using the app.
  if (!isPilot || !inWindow) return null;

  // The app is mid-explanation. Two cards in one launch is a stack, not a
  // conversation.
  if (teachingCardShown) return null;

  if (shownThisLaunch >= LAUNCH_CAP) return null;

  const dueCheckpoint = PILOT_PROMPTS.find(
    (p) => p.kind === "checkpoint" && p.day != null && day >= p.day && !alreadyAsked(log, p.id),
  );
  if (dueCheckpoint) return dueCheckpoint;

  if (now - lastShownAt(log) < COOLDOWN_MS) return null;

  return (
    PILOT_PROMPTS.find(
      (p) => p.kind === "contextual" && !alreadyAsked(log, p.id) && (p.requires?.(signals) ?? true),
    ) ?? null
  );
};
