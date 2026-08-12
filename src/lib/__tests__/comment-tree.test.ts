// buildCommentTree is the single source of truth for BOTH the global feed
// and the tribe feed — nesting/sort behavior must never drift.
import { describe, it, expect } from "vitest";
import { buildCommentTree, MAX_VISUAL_DEPTH } from "@/lib/comment-tree";

const c = (id: string, parent_id: string | null, created_at: string) => ({ id, parent_id, created_at });

describe("buildCommentTree", () => {
  it("returns [] for empty/undefined input", () => {
    expect(buildCommentTree(undefined)).toEqual([]);
    expect(buildCommentTree([])).toEqual([]);
  });

  it("nests children under parents and sorts oldest-first per branch", () => {
    const tree = buildCommentTree([
      c("b", null, "2026-01-02T00:00:00Z"),
      c("a", null, "2026-01-01T00:00:00Z"),
      c("b2", "b", "2026-01-04T00:00:00Z"),
      c("b1", "b", "2026-01-03T00:00:00Z"),
    ]);
    expect(tree.map((n) => n.id)).toEqual(["a", "b"]);
    expect(tree[1].children.map((n: any) => n.id)).toEqual(["b1", "b2"]);
  });

  it("orphaned parent_id (deleted parent) promotes the comment to a root", () => {
    const tree = buildCommentTree([c("child", "deleted-parent", "2026-01-01T00:00:00Z")]);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("child");
    expect(tree[0].depth).toBe(0);
  });

  it("clamps depth at MAX_VISUAL_DEPTH so deep chains stay readable", () => {
    // Chain 8 levels deep: a → b → c → …
    const flat = Array.from({ length: 8 }, (_, i) =>
      c(`n${i}`, i === 0 ? null : `n${i - 1}`, `2026-01-0${(i % 9) + 1}T00:00:00Z`),
    );
    const tree = buildCommentTree(flat);
    let node: any = tree[0];
    let deepest = 0;
    while (node.children.length) {
      node = node.children[0];
      deepest = node.depth;
    }
    expect(deepest).toBe(MAX_VISUAL_DEPTH);
  });
});
