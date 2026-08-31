/**
 * Strips a trailing coach sign-off from generated brief text.
 *
 * coach-daily-brief used to instruct the model to sign off as "— W Coach".
 * That instruction is gone (ai-coach already said "no sign-off", so the two
 * disagreed), but rows written before the change still carry it in
 * coach_daily_briefs.brief_md — and there is no backfill, so the string has
 * to be handled at render time, indefinitely.
 *
 * Both spellings are matched: the old "W Coach" and the "AI Coach" a model
 * might still volunteer despite the prompt. The surface always labels itself
 * already, so repeating the name inside a two-line preview only costs space.
 *
 * Lives here rather than inline in one component because both surfaces that
 * render a brief need it — CoachStrip on Home and CoachBriefHero on the Coach
 * page. The latter rendered the raw text, so old briefs showed the sign-off
 * there while Home quietly hid it.
 */
const SIGNOFF = /[—–-]\s*(?:AI\s+|W\s+)?Coach\s*\.?\s*$/i;

export const stripCoachSignoff = (text: string | null | undefined): string => {
  if (!text) return "";
  return text.replace(SIGNOFF, "").trim();
};

/**
 * First readable sentence of a brief, markdown stripped and sign-off removed —
 * for one-line previews.
 */
export const briefPreview = (md: string | null | undefined, maxLen = 170): string | null => {
  if (!md) return null;
  const clean = stripCoachSignoff(md.replace(/[*_#>`]/g, "")).trim();
  if (!clean) return null;
  const firstSentence = clean.split(/(?<=[.!?])\s/)[0] ?? clean;
  return firstSentence.slice(0, maxLen).trim() || null;
};
