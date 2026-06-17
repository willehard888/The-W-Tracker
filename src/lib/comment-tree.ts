// Shared comment-thread helpers used by the global feed (EliteFeed) and the
// tribe feed (TribePostCard). Extracted to a single source of truth so the
// nesting/sort behaviour can never drift between the two surfaces.

export type CommentNode = any & { children: CommentNode[]; depth: number };

/** Cap visual indentation so deep reply chains stay readable on mobile. */
export const MAX_VISUAL_DEPTH = 4;

/**
 * Turn a flat list of comments (each with `id`, `parent_id`, `created_at`)
 * into a nested tree. Children are sorted oldest-first within each branch and
 * depth is clamped to MAX_VISUAL_DEPTH.
 */
export const buildCommentTree = (flat: any[] | undefined): CommentNode[] => {
  if (!flat || flat.length === 0) return [];
  const map = new Map<string, CommentNode>();
  flat.forEach((c) => map.set(c.id, { ...c, children: [], depth: 0 }));
  const roots: CommentNode[] = [];
  map.forEach((node) => {
    if (node.parent_id && map.has(node.parent_id)) {
      const parent = map.get(node.parent_id)!;
      node.depth = Math.min(parent.depth + 1, MAX_VISUAL_DEPTH);
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });
  // Sort children by oldest-first within each branch
  const sortRec = (nodes: CommentNode[]) => {
    nodes.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    nodes.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
};
