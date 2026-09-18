/**
 * The legal entity behind Whealth Factory: the App Store seller, the party the
 * Terms are made with, and the data controller named in the Privacy Policy.
 * Those three must be the same string, so it lives here once, spelled exactly
 * as the Finnish Trade Register has it (checked against PRH, 2026-09-18).
 *
 * The copies that cannot import this — public/support.html, public/waitlist.html,
 * the waitlist email and the App Store listing script — are held to it by
 * src/lib/__tests__/company.test.ts. The listing's copyright line once read
 * "Whealth-Factory": that drift is what the test is for.
 */
export const COMPANY = {
  name: "Whealth Factory Corporation Finland Oy",
  businessId: "3636449-8",
  street: "Soukansalmentie 30 A",
  postcode: "02360",
  city: "Espoo",
  country: "Finland",
  email: "support@whealthfactory.com",
} as const;

export const COMPANY_ADDRESS = `${COMPANY.street}, ${COMPANY.postcode} ${COMPANY.city}, ${COMPANY.country}`;

/**
 * Finnish business ID check digit (Y-tunnus): weights 7 9 10 5 8 4 2 over the
 * seven digits, sum mod 11; remainder 0 gives 0, remainder 1 is never issued,
 * anything else gives 11 − remainder.
 */
export function isValidBusinessId(id: string): boolean {
  const m = /^(\d{7})-(\d)$/.exec(id);
  if (!m) return false;
  const weights = [7, 9, 10, 5, 8, 4, 2];
  const sum = [...m[1]].reduce((acc, d, i) => acc + Number(d) * weights[i], 0);
  const r = sum % 11;
  if (r === 1) return false;
  return (r === 0 ? 0 : 11 - r) === Number(m[2]);
}
