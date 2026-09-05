// Contextual onboarding — spotlight on the real UI (Blueprint §3).
// The cutout IS a fixed box over the target with a 9999px shadow halo:
// trivial to animate, radius copied from the target's computed style, zero
// backdrop-filter (dialog.tsx documents the WKWebView risk). A breathing
// gold ring around the cutout is the one deliberate spectacle — everything
// else stays calm chrome. The halo is pointer-events-none: the real app
// stays interactive underneath; only the card takes input, and a dismiss
// control is always present.
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { Portal } from "@/components/ui/Portal";
import { Button } from "@/components/ui/button";
import { hapticSelection } from "@/lib/haptics";
import { placeCard, type Rect } from "@/lib/onboarding/placement";
import type { OnboardingEventDef } from "@/lib/onboarding/types";
import { EVENT_ICONS } from "./event-icons";

const PAD = 6; // breathing room around the target inside the cutout
const CARD_W = 288;
const CARD_H_ESTIMATE = 172; // icon row + eyebrow + 2 body lines + CTA
// Clamp constants: status-bar/safe-top ≈ 48, BottomNav + safe-bottom ≈ 96.
const INSET_TOP = 48;
const INSET_BOTTOM = 96;

interface SpotlightOverlayProps {
  def: OnboardingEventDef;
  target: HTMLElement;
  onComplete: () => void;
  onSkip: () => void;
}

export default function SpotlightOverlay({ def, target, onComplete, onSkip }: SpotlightOverlayProps) {
  const reduced = useReducedMotion();
  const Icon = EVENT_ICONS[def.id];
  const [rect, setRect] = useState<Rect | null>(null);
  const [radius, setRadius] = useState("12px");
  const frame = useRef(0);

  // Learn by doing: tapping the spotlighted element itself completes the
  // card — the real action happens underneath untouched (no preventDefault).
  // Refs keep the listener stable across parent re-renders.
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;
  useEffect(() => {
    const onTargetTap = () => {
      hapticSelection();
      completeRef.current();
    };
    target.addEventListener("click", onTargetTap, { capture: true, once: true });
    return () => target.removeEventListener("click", onTargetTap, { capture: true });
  }, [target]);

  // A light tap when the coach steps in — once per card.
  useEffect(() => {
    hapticSelection();
  }, [def.id]);

  useEffect(() => {
    const measure = () => {
      // Fail-open: a detached OR merely hidden target stops rendering this
      // tick. Tab pages stay mounted in the background (perf architecture),
      // so a target can still measure at its old coordinates from another
      // page — offsetParent goes null under display:none, and a zero-size
      // rect catches the rest. The card resumes when the target is back.
      const r = target.getBoundingClientRect();
      if (!target.isConnected || target.offsetParent === null || r.width === 0 || r.height === 0) {
        setRect(null);
        return;
      }
      const next = { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 };
      // Identity-stable: the 300ms heartbeat must not re-render a still card.
      setRect((prev) =>
        prev &&
        prev.top === next.top &&
        prev.left === next.left &&
        prev.width === next.width &&
        prev.height === next.height
          ? prev
          : next,
      );
      try {
        const br = getComputedStyle(target).borderRadius;
        if (br && br !== "0px") setRadius(br);
      } catch {
        /* keep default */
      }
    };
    measure();
    const onMove = () => {
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(measure);
    };
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    // SPA navigation moves/hides targets without firing scroll or resize —
    // the observers catch it (display:none reads as a 0×0 resize), so no
    // 300 ms polling timer runs for the life of the card.
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(onMove) : null;
    ro?.observe(target);
    const io = typeof IntersectionObserver === "function"
      ? new IntersectionObserver(onMove, { threshold: [0, 0.25, 0.5, 0.75, 1] })
      : null;
    io?.observe(target);
    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
      ro?.disconnect();
      io?.disconnect();
      cancelAnimationFrame(frame.current);
    };
  }, [target]);

  if (!rect) return null;

  const placement = placeCard(
    rect,
    { width: CARD_W, height: CARD_H_ESTIMATE },
    {
      width: window.innerWidth,
      height: window.innerHeight,
      insetTop: INSET_TOP,
      insetBottom: INSET_BOTTOM,
    },
    "bottom",
  );

  return (
    <Portal>
      {/* overflow-hidden bounds the 9999px halo's paint region to the
          viewport — without it the compositor rasterizes the full shadow
          extent (a ~20000px layer; visibly expensive in WKWebView). */}
      <div className="fixed inset-0 z-[var(--z-onboarding)] pointer-events-none overflow-hidden">
        {/* Cutout box — its 9999px shadow IS the dim layer. */}
        <div
          className={reduced ? "fixed" : "fixed animate-in fade-in duration-300"}
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            borderRadius: radius,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.62)",
            transition: reduced ? undefined : "top .2s ease, left .2s ease, width .2s ease, height .2s ease",
          }}
        />
        {/* Gold ring: locks onto the target (scale-in), then breathes — the
            one spectacle. Separate layer so the dim shadow never repaints. */}
        <div
          className={reduced ? "fixed" : "fixed onboarding-ring"}
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            borderRadius: radius,
            boxShadow:
              "0 0 0 2px hsl(var(--gold) / 0.55), 0 0 24px 4px hsl(var(--gold) / 0.28), inset 0 0 18px hsl(var(--gold) / 0.12)",
            transition: reduced ? undefined : "top .2s ease, left .2s ease, width .2s ease, height .2s ease",
          }}
        />
        {/* Coach card — the only interactive element. */}
        <div
          role="dialog"
          aria-label={def.title}
          className={`fixed pointer-events-auto surface-card rounded-2xl border border-gold/30 p-4 shadow-3 ${
            reduced ? "" : "animate-in fade-in slide-in-from-bottom-2 zoom-in-95 duration-300"
          }`}
          style={
            placement
              ? { top: placement.top, left: placement.left, width: CARD_W }
              : {
                  // Fallback: bottom-of-safe-area, explicit top (bottom-
                  // anchoring misplaced the card in short viewports).
                  top: Math.max(
                    INSET_TOP + 12,
                    window.innerHeight - INSET_BOTTOM - 12 - CARD_H_ESTIMATE,
                  ),
                  left: Math.max(12, (window.innerWidth - CARD_W) / 2),
                  width: CARD_W,
                }
          }
        >
          <button
            onClick={() => {
              hapticSelection();
              onSkip();
            }}
            aria-label="Skip"
            className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground/60 hover:text-foreground transition-colors before:absolute before:-inset-2 before:content-['']"
          >
            <X size={15} />
          </button>
          <div className="flex items-start gap-3 pr-6">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold/12 text-gold">
              <Icon size={17} strokeWidth={2.4} />
            </div>
            <div className="min-w-0">
              <p className="eyebrow-sm mb-0.5 text-gold">
                <span aria-hidden className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-gold align-middle" />
                AI Coach
              </p>
              <h3 className="font-display text-[15px] font-black tracking-tight leading-tight">{def.title}</h3>
              <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{def.body}</p>
            </div>
          </div>
          <Button
            variant="ember"
            className="mt-3.5 w-full"
            onClick={() => {
              hapticSelection();
              onComplete();
            }}
          >
            {def.cta}
          </Button>
        </div>
      </div>
    </Portal>
  );
}
