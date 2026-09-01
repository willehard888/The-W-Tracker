// Contextual onboarding — coach-card placement (Onboarding Blueprint §3).
// Hand-rolled on purpose: the app is a fixed max-w-md single column, narrow
// enough that a simple edge-preference algorithm fully covers it. Returns
// null when nothing fits — the caller falls back to the bottom sheet.

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface Viewport {
  width: number;
  height: number;
  /** Safe-area insets + BottomNav height already folded in by the caller. */
  insetTop: number;
  insetBottom: number;
}

export type Edge = "bottom" | "top" | "right" | "left";

const GAP = 12; // breathing room between target and card
const MARGIN = 12; // min distance from viewport edges

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

const tryEdge = (
  edge: Edge,
  target: Rect,
  card: { width: number; height: number },
  vp: Viewport,
): { top: number; left: number } | null => {
  const minTop = vp.insetTop + MARGIN;
  const maxBottom = vp.height - vp.insetBottom - MARGIN;

  if (edge === "bottom" || edge === "top") {
    const top =
      edge === "bottom" ? target.top + target.height + GAP : target.top - GAP - card.height;
    if (top < minTop || top + card.height > maxBottom) return null;
    const left = clamp(
      target.left + target.width / 2 - card.width / 2,
      MARGIN,
      vp.width - MARGIN - card.width,
    );
    if (left < MARGIN - 0.5 || left + card.width > vp.width - MARGIN + 0.5) return null;
    return { top, left };
  }

  const left = edge === "right" ? target.left + target.width + GAP : target.left - GAP - card.width;
  if (left < MARGIN || left + card.width > vp.width - MARGIN) return null;
  const top = clamp(
    target.top + target.height / 2 - card.height / 2,
    minTop,
    maxBottom - card.height,
  );
  if (top < minTop - 0.5 || top + card.height > maxBottom + 0.5) return null;
  return { top, left };
};

/**
 * Preferred edge → its opposite → the two perpendiculars, each clamped
 * inside the safe area. null → nothing fits → bottom-sheet fallback.
 */
export const placeCard = (
  target: Rect,
  card: { width: number; height: number },
  vp: Viewport,
  preferred: Edge = "bottom",
): { top: number; left: number; edge: Edge } | null => {
  const opposite: Record<Edge, Edge> = { bottom: "top", top: "bottom", left: "right", right: "left" };
  const perpendicular: Edge[] = preferred === "bottom" || preferred === "top"
    ? ["right", "left"]
    : ["bottom", "top"];
  const order: Edge[] = [preferred, opposite[preferred], ...perpendicular];
  for (const edge of order) {
    const pos = tryEdge(edge, target, card, vp);
    if (pos) return { ...pos, edge };
  }
  return null;
};
