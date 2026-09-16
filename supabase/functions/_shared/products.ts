/**
 * The App Store products that grant Premium. ONE list, mirrored by
 * src/lib/products.ts on the client (a parity test keeps them equal):
 * a product the client can buy but the webhook does not recognise is a
 * purchase that never grants access, and that has happened.
 *
 * WhealthFactory499 = 8,99 €/month; WhealthFactoryYearly = 89,99 €/year, both
 * in the "Whealth Factory" subscription group (the group is what lets Apple
 * offer upgrade/downgrade between them). eliteyearly4799 was the yearly plan
 * before 2026-09-15; it lives in a different group and stays only so an
 * existing subscription keeps its access.
 */
export const MONTHLY_PRODUCT_IDS = ["WhealthFactory499", "com.app.WhealthFactory499"] as const;
export const YEARLY_PRODUCT_IDS = ["WhealthFactoryYearly", "com.app.WhealthFactoryYearly"] as const;
export const LEGACY_PREMIUM_PRODUCT_IDS = [
  "eliteyearly4799", "com.app.eliteyearly4799",
  "premiummonthly1799", "com.app.premiummonthly1799",
  "premiumyearly17299", "com.app.premiumyearly17299",
] as const;
export const PREMIUM_PRODUCT_IDS: readonly string[] = [...MONTHLY_PRODUCT_IDS, ...YEARLY_PRODUCT_IDS, ...LEGACY_PREMIUM_PRODUCT_IDS];
