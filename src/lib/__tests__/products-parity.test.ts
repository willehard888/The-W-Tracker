import { describe, expect, it } from "vitest";
import * as client from "@/lib/products";
import * as shared from "../../../supabase/functions/_shared/products";

// The webhook grants access by product id; the client buys by product id.
// Two copies exist because Deno and Vite cannot share a file; this keeps
// them one list.
describe("premium product ids", () => {
  it("are the same list on the client and in the webhook", () => {
    expect([...client.MONTHLY_PRODUCT_IDS]).toEqual([...shared.MONTHLY_PRODUCT_IDS]);
    expect([...client.YEARLY_PRODUCT_IDS]).toEqual([...shared.YEARLY_PRODUCT_IDS]);
    expect([...client.PREMIUM_PRODUCT_IDS]).toEqual([...shared.PREMIUM_PRODUCT_IDS]);
  });
  it("carry the yearly plan in the Whealth Factory group, and the old one only as legacy", () => {
    expect(client.YEARLY_PRODUCT_IDS).toContain("WhealthFactoryYearly");
    expect(client.LEGACY_PREMIUM_PRODUCT_IDS).toContain("eliteyearly4799");
    expect(client.PREMIUM_PRODUCT_IDS).toContain("eliteyearly4799");
  });
});
