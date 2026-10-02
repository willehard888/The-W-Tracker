/**
 * The chat coach ends every coaching reply with a trailer the member never
 * sees:
 *
 *     …one concrete next move.
 *     @@FOLLOWUPS
 *     - Should I add 2.5 kg to the squat on Thursday?
 *     - Why was my HRV down after Tuesday?
 *
 * The app turns the lines into tap targets under the reply, so the next
 * question is a tap, not a typed sentence. These two helpers split the
 * trailer off a finished reply and hide a half-arrived one while streaming.
 */
export const FOLLOWUPS_MARKER = "@@FOLLOWUPS";
export const MAX_FOLLOWUPS = 3;
export const FOLLOWUP_MAX_CHARS = 72;

/** Strip the markdown the model sometimes wraps the marker or a line in. */
const trimEdges = (s: string) => s.replace(/^[\s`*_]+|[\s`*_]+$/g, "");

/** A finished reply → the visible body and up to three questions. */
export const splitFollowups = (text: string): { body: string; questions: string[] } => {
  const i = text.indexOf(FOLLOWUPS_MARKER);
  if (i === -1) return { body: text, questions: [] };
  const body = trimEdges(text.slice(0, i));
  const questions = text
    .slice(i + FOLLOWUPS_MARKER.length)
    .split("\n")
    .map((l) => trimEdges(l.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, "")))
    .filter((q) => q.length > 3)
    .map((q) => q.slice(0, FOLLOWUP_MAX_CHARS))
    .slice(0, MAX_FOLLOWUPS);
  return { body, questions };
};

/**
 * The text to show while the reply is still arriving: everything before the
 * marker, and nothing of a marker that has only half arrived ("@@FOL").
 */
export const visibleWhileStreaming = (text: string): string => {
  const i = text.indexOf(FOLLOWUPS_MARKER);
  if (i !== -1) return trimEdges(text.slice(0, i));
  const partial = text.match(/\n?[`*_]*@{1,2}[A-Z]{0,10}[`*_]*$/);
  return partial ? text.slice(0, partial.index) : text;
};
