// The spoken half of a guided session.
//
// Each routine that has a voice ships one file: the same lines the screen shows,
// spoken at the same seconds, with real silence in between. The file is the
// whole session, so the player only ever has to agree with the runner about one
// number — how far into the session we are — and a seek fixes any drift after a
// pause, a skip, or a locked screen.
//
// WHY THE AUDIO IS IN THE APP AND NOT ON A SERVER
//
// 94 minutes at 32 kbps is 22 MB, which is more than the drawings but less than
// the sourcemaps that already ship. In exchange a session starts instantly, runs
// on a plane and in a basement gym, and there is no cache, no signed URL and no
// half-downloaded file to get wrong. If the library grows past a handful of
// hours this is the decision to revisit, and the only thing that changes is
// where `voiceSrc` points.
import { readLocal, writeLocal } from "@/lib/storage";

/** Routines with a recorded voice, by routine id. */
const VOICED = new Set([
  "stress-reset",
  "box-five",
  "even-breathing",
  "five-senses-reset",
  "four-seven-eight-sleep",
  "park-the-day-sleep",
  "tense-release",
  "body-scan-10",
  "nsdr-ten",
  "nsdr-twenty",
  "meditation-10",
  "open-awareness-10",
]);

/** The file name differs from the routine id where the routine was renamed. */
const FILE: Record<string, string> = {
  "five-senses-reset": "five-senses",
  "park-the-day-sleep": "park-the-day",
  "tense-release": "pmr",
  "body-scan-10": "body-scan",
  "nsdr-ten": "nsdr-10",
  "nsdr-twenty": "nsdr-20",
  "meditation-10": "breath-focus",
  "open-awareness-10": "open-awareness",
};

export const hasVoice = (routineId?: string | null): boolean => !!routineId && VOICED.has(routineId);

export const voiceSrc = (routineId: string): string =>
  `/audio/recovery/${FILE[routineId] ?? routineId}.mp3`;

const KEY = "recovery-voice-off";

/** Voice is on unless the athlete turned it off; the choice sticks. */
export const voiceOn = (): boolean => readLocal(KEY) !== "1";

export const setVoiceOn = (on: boolean): void => {
  writeLocal(KEY, on ? "0" : "1");
};

/**
 * How far the audio may drift from the session clock before it is corrected.
 *
 * Small corrections are worse than the drift: seeking mid-word is audible, and
 * a phone that throttled the timer by a few hundred milliseconds does not need
 * fixing. Anything past a second is a skip, a pause or a locked screen, and
 * that does.
 */
export const DRIFT_SEC = 1;

export const needsSeek = (audioSec: number, sessionSec: number): boolean =>
  Math.abs(audioSec - sessionSec) > DRIFT_SEC;
