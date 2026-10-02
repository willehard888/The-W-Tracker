import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { VaultArticleSummary } from "@/hooks/use-vault-articles";

/**
 * The piece opens in the app's own sheet chrome: the header names the shelf
 * and the place ("Wisdom · Lesson 2 of 3"), the body opens with the grade,
 * the length and the title in the page voice. The old hero carried a third
 * chip for the lesson and a 22 px title of its own.
 */
vi.mock("@/components/ui/sheet-bottom", () => ({
  BottomSheet: ({ open, title, subtitle, children }: { open: boolean; title?: string; subtitle?: string; children: React.ReactNode }) =>
    open ? <section aria-label={title}><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}{children}</section> : null,
}));
vi.mock("@/components/vault/PracticeLoop", () => ({ default: () => null }));
vi.mock("@/lib/analytics", async (orig) => ({ ...(await orig<typeof import("@/lib/analytics")>()), track: vi.fn() }));
vi.mock("@/hooks/use-vault-progress", () => ({ useVaultProgress: () => ({ data: [] }) }));

const piece = (n: number, over: Partial<VaultArticleSummary> = {}): VaultArticleSummary => ({
  id: `a${n}`, category_id: "wisdom", slug: `piece-${n}`, title: `Piece ${n}`, subtitle: n === 2 ? "One line under it" : null,
  summary: "The summary.", evidence_tier: "promising", read_time_min: 7, display_order: n, lesson_number: n,
  course_role: "protocol", master_slug: null, reflect_prompt: null, practice_minutes: null, ...over,
});
const LIB = [piece(1), piece(2), piece(3)];
vi.mock("@/hooks/use-vault-articles", () => ({
  useVaultArticles: () => ({ data: LIB }),
  useVaultArticle: () => ({ data: undefined, isLoading: true, isError: false, refetch: vi.fn() }),
}));

import VaultArticleSheet from "@/components/vault/VaultArticleSheet";

describe("VaultArticleSheet — the sheet's own header", () => {
  it("names the shelf and the lesson in the header, the piece in the page voice below", () => {
    render(<VaultArticleSheet article={LIB[1]} accent="#abc" open onClose={() => {}} />);
    expect(screen.getByRole("heading", { level: 2, name: "Wisdom" })).toBeInTheDocument();
    expect(screen.getAllByText("Lesson 2 of 3")).toHaveLength(1);
    const title = screen.getByRole("heading", { level: 1, name: "Piece 2" });
    expect(title).toHaveClass("h-page");
    expect(screen.getByText("Promising")).toBeInTheDocument();
    expect(screen.getByText(/7 min/)).toBeInTheDocument();
    expect(screen.getByText("One line under it")).toBeInTheDocument();
  });
});
