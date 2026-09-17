/**
 * Which handles a member may not claim (App Review 1.2: a username is
 * user-generated content shown on every post, battle and leaderboard row).
 *
 * Two lists, two rules. A slur is refused anywhere inside the name. A word
 * that would pass for staff is refused only as the whole name, so
 * `apple_pie` and `supportive_sam` stay free.
 *
 * ponytail: a fixed English list with naive substring matching. It will
 * refuse the odd innocent name, and the member picks another. It is also
 * client-side only: the same check belongs in `update_own_profile` before it
 * counts as enforcement. Move to a server list when either starts to hurt.
 */

/** Refused anywhere inside the name. Chosen to be rare inside ordinary words. */
const BLOCKED_ANYWHERE = [
  "nigger", "nigga", "faggot", "retard", "tranny", "kike", "chink", "gook",
  "wetback", "beaner", "nazi", "hitler",
  "fuck", "shit", "cunt", "bitch", "whore", "slut", "pussy", "penis", "vagina",
  "porn", "rapist", "pedophile", "paedo", "molest", "blowjob", "dildo", "jizz",
];

/** Refused as the whole name: they read as the team speaking. */
const RESERVED_WHOLE = new Set([
  "admin", "administrator", "support", "moderator", "mod", "staff", "official",
  "apple", "whealthfactory", "whealth", "system", "help",
]);

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t" };

/**
 * A name is read two ways, because a digit is either a disguise (`sh1t`,
 * `adm1n`) or padding (`admin1`, `fuck99`): once with the look-alike digits
 * turned back into letters, once with every digit dropped. Underscores go in
 * both, so `a_d_m_i_n` is `admin`.
 */
const readings = (name: string): [string, string] => {
  const flat = name.toLowerCase().replace(/_/g, "");
  return [flat.replace(/[013457]/g, (d) => LEET[d]), flat.replace(/[0-9]/g, "")];
};

export const isUsernameAllowed = (name: string): boolean =>
  readings(name).every(
    (reading) => !RESERVED_WHOLE.has(reading) && !BLOCKED_ANYWHERE.some((word) => reading.includes(word)),
  );
