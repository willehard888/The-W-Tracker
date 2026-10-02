import "@/test/route-mocks";
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { setMode } from "@/test/supabase-stub";
import { mountRoute } from "@/test/mount-route";
import Vault from "@/pages/Vault";
import { VAULT_PATHS } from "@/data/vault-paths";
import { VAULT_MASTERS } from "@/data/vault-masters";

/**
 * One language on the Vault index: `h-card` sections, the app's DoorRow on
 * hairlines for paths and masters (a chevron on every door), six masters with
 * the rest folded, and the covers still the accordion they were.
 */
describe("Vault index — one vocabulary", () => {
  beforeEach(() => { setMode("empty"); mountRoute("/vault", "/vault", Vault); });
  afterEach(cleanup);

  it("names its three sections in the card voice", async () => {
    for (const name of ["Paths", "Masters", "The shelf"]) {
      const h = await screen.findByRole("heading", { name });
      expect(h).toHaveClass("h-card");
    }
  });

  // Text lookups inside the section: an accessible-name query over every
  // button on the page, 27 times, is what timed this file out under load.
  it("every path is a door row with a chevron", async () => {
    await screen.findByRole("heading", { name: "Paths" });
    const section = screen.getByRole("heading", { name: "Paths" }).closest("section")!;
    for (const p of VAULT_PATHS) {
      const row = within(section).getByText(p.title).closest("button")!;
      expect(row.className.split(" ")).toContain("press-row");
      expect(row.querySelector("svg.lucide-chevron-right")).not.toBeNull();
    }
  });

  it("shows six masters and folds the rest behind one toggle", async () => {
    await screen.findByRole("heading", { name: "Masters" });
    const section = screen.getByRole("heading", { name: "Masters" }).closest("section")!;
    for (const m of VAULT_MASTERS.slice(0, 6)) expect(within(section).getByText(m.name).closest("button")).not.toBeNull();
    expect(within(section).queryByText(VAULT_MASTERS[6].name)).toBeNull();
    const fold = within(section).getByText(`All ${VAULT_MASTERS.length} thinkers`).closest("button")!;
    expect(fold).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(fold);
    expect(fold).toHaveAttribute("aria-expanded", "true");
    for (const m of VAULT_MASTERS) expect(within(section).getByText(m.name)).toBeInTheDocument();
  });

  it("a cover is still the accordion: aria-expanded flips and the shelf opens under it", async () => {
    await screen.findByRole("heading", { name: "The shelf" });
    const cover = screen.getByRole("button", { name: /Twenty-one thinkers/ });
    expect(cover).toHaveAttribute("aria-expanded", "false");
    expect(cover).toHaveAttribute("aria-controls", "vault-shelf-wisdom");
    fireEvent.click(cover);
    expect(cover).toHaveAttribute("aria-expanded", "true");
    await waitFor(() => expect(within(document.getElementById("vault-shelf-wisdom")!).getByText("No articles yet")).toBeInTheDocument());
  });
});
