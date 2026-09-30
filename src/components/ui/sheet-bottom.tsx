import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, m, useDragControls, useMotionValue, useReducedMotion, useTransform, type PanInfo } from "framer-motion";
import { ChevronLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useScrollLock } from "@/contexts/ScrollContainerContext";
import { cn } from "@/lib/utils";
import { hapticImpact } from "@/lib/haptics";
import { MOTION } from "@/lib/motion";

/**
 * THE bottom sheet. A fixed overlay portalled to <body> with a solid backdrop
 * (Radix portals under transformed ancestors have failed to surface on iOS
 * WKWebView), a spring rise (plain fade under reduced motion), safe-area
 * bottom, a drag handle that drags — pull the handle or the header down and
 * the sheet follows the thumb, the backdrop thinning with it; a flick or a
 * third of the way closes it, anything less springs back — and one header
 * row: back · title/subtitle · close.
 * Pass no `title` to keep a custom hero as content — the close button then
 * floats top-right. The shell scroller is locked while open (useScrollLock).
 *
 * The overlay is sized to the VISUAL viewport, not the layout viewport. There
 * is no keyboard plugin (its native sources kept breaking Xcode Cloud), so on
 * iOS the WebView does not shrink for the keyboard: it scrolls the layout
 * viewport to reveal the focused field, dragging every fixed overlay up with
 * it — the coach chat opened with its header off the top of the screen and
 * the input under the keys. Following visualViewport's height and offset
 * keeps the sheet on screen and the footer above the keyboard.
 */
/** Open sheets, bottom to top: Escape belongs to the last one. */
const OPEN_SHEETS: object[] = [];

/** A pull past 96 px, or a flick faster than 500 px/s, means "close". */
export const dismissesOnRelease = (offsetY: number, velocityY: number): boolean =>
  offsetY > 96 || (offsetY > 24 && velocityY > 500);

const useVisualViewport = (active: boolean) => {
  const read = () => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    return {
      height: vv?.height ?? (typeof window !== "undefined" ? window.innerHeight : 800),
      offsetTop: vv?.offsetTop ?? 0,
    };
  };
  const [box, setBox] = useState(read);
  useEffect(() => {
    const vv = window.visualViewport;
    // Only while open: three sheets sit closed on Home, and each used to
    // re-render on every keyboard frame app-wide.
    if (!vv || !active) return;
    const sync = () => setBox((prev) => {
      const next = read();
      return prev.height === next.height && prev.offsetTop === next.offsetTop ? prev : next;
    });
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => { vv.removeEventListener("resize", sync); vv.removeEventListener("scroll", sync); };
  }, [active]);
  return box;
};

export const BottomSheet = ({
  open,
  onClose,
  label,
  title,
  subtitle,
  onBack,
  leading,
  height = "auto",
  headerExtra,
  bodyRef,
  bodyClassName,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  /** Accessible name for the dialog. */
  label: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  onBack?: () => void;
  /** Replaces the back slot (e.g. a "new chat" button). */
  leading?: ReactNode;
  /** auto: fits content up to 93vh · tall: a fixed 90dvh drawer. */
  height?: "auto" | "tall";
  /** Non-scrolling strip between the header and the body. */
  headerExtra?: ReactNode;
  bodyRef?: RefObject<HTMLDivElement>;
  bodyClassName?: string;
  children: ReactNode;
  footer?: ReactNode;
}) => {
  useScrollLock(open);
  // Escape closes the TOPMOST sheet (keyboard and desktop web; iOS has no such
  // key). Every open sheet listens, so without the stack one keystroke closed
  // a picker and the sheet under it together.
  useEffect(() => {
    if (!open) return;
    const token = {};
    OPEN_SHEETS.push(token);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && OPEN_SHEETS[OPEN_SHEETS.length - 1] === token) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      const i = OPEN_SHEETS.indexOf(token);
      if (i >= 0) OPEN_SHEETS.splice(i, 1);
    };
  }, [open, onClose]);
  const reduced = useReducedMotion();
  const viewport = useVisualViewport(open);
  const rise = reduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: MOTION.fade }
    : { initial: { y: "100%" }, animate: { y: 0 }, exit: { y: "100%" }, transition: MOTION.drawer };

  // Drag to dismiss. The gesture starts on the handle/header only, so the
  // body keeps its native scroll; the sheet's own `y` drives the backdrop.
  const drag = useDragControls();
  const y = useMotionValue(0);
  const backdropOpacity = useTransform(y, [0, 320], [1, 0.15]);
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (!dismissesOnRelease(info.offset.y, info.velocity.y)) return;
    void hapticImpact("light");
    onClose();
  };

  // Focus lands in the dialog when it opens (screen readers and the keyboard
  // start inside it) — unless a child took it first, like the chat's input.
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      const el = dialogRef.current;
      if (el && !el.contains(document.activeElement)) el.focus({ preventScroll: true });
    }, 60);
    return () => clearTimeout(t);
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <m.div
          ref={dialogRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={label}
          className="fixed inset-0 z-[var(--z-celebration)] outline-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={MOTION.fade}
        >
          {/* Solid backdrop — no backdrop-filter, which iOS WKWebView mis-composites.
              It covers the whole layout viewport, not the visual one: the web view
              keeps painting the page behind the keyboard, and a backdrop that
              stopped at the visual viewport left a band of live page above the
              keyboard (the keyboard's glass accessory bar refracted it). */}
          <m.div className="absolute inset-0 bg-black/70" style={{ opacity: backdropOpacity }} onClick={onClose} aria-hidden />
          {/* The drawer's box is what is actually visible: with the keyboard up
              that is the space above it. */}
          <div className="absolute inset-x-0 flex flex-col pointer-events-none" style={{ top: viewport.offsetTop, height: viewport.height }}>
          <m.div
            className={cn(
              "pointer-events-auto relative mt-auto flex flex-col w-full rounded-t-[28px] border-t border-white/10 bg-[hsl(255_14%_7%)] shadow-[0_-20px_60px_-12px_hsl(0_0%_0%/0.7)] overflow-hidden",
            )}
            {...rise}
            drag={reduced ? false : "y"}
            dragListener={false}
            dragControls={drag}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.04, bottom: 1 }}
            dragSnapToOrigin
            onDragEnd={onDragEnd}
            style={{
              y,
              // The home-indicator clearance is for the home indicator: with
              // the keyboard up it sits behind the keyboard, and the sheet
              // used to keep a 34 pt dead band between the input and the keys.
              paddingBottom: viewport.height < window.innerHeight - 120 ? "0.75rem" : "max(1rem, env(safe-area-inset-bottom))",
              // 90 % / 93 % of what is actually visible — with the keyboard
              // up that is the space above it, not the whole screen.
              ...(height === "tall"
                ? { height: Math.round(viewport.height * 0.9) }
                : { maxHeight: Math.round(viewport.height * 0.93) }),
            }}
          >
            {/* The grab zone: handle + header. touch-action: none here only, so
                a vertical pull is the sheet's, not the page's. */}
            <div className="shrink-0 cursor-grab active:cursor-grabbing [touch-action:none]" onPointerDown={(e) => drag.start(e)}>
            <div className="flex justify-center pt-2.5 pb-1">
              <div className="h-1 w-10 rounded-full bg-white/20" />
            </div>
            {title ? (
              <div className="px-3 pt-1 pb-2 flex items-center gap-1">
                {leading ?? (onBack ? (
                  <Button variant="ghost" size="icon" aria-label="Back" className="min-h-11 min-w-11" onClick={onBack}>
                    <ChevronLeft aria-hidden size={20} />
                  </Button>
                ) : (
                  <span className="w-11" aria-hidden />
                ))}
                <div className="flex-1 min-w-0 text-center">
                  <div className="h-card truncate">{title}</div>
                  {subtitle && <p className="text-label text-muted-foreground truncate">{subtitle}</p>}
                </div>
                <Button variant="ghost" size="icon" aria-label="Close" className="min-h-11 min-w-11" onClick={onClose}>
                  <X size={20} aria-hidden />
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close"
                className="absolute top-1.5 right-2 z-10 min-h-11 min-w-11 rounded-full bg-background/60"
                onClick={onClose}
              >
                <X size={20} aria-hidden />
              </Button>
            )}
            </div>
            {headerExtra && <div className="shrink-0">{headerExtra}</div>}
            <div ref={bodyRef} className={cn("flex-1 min-h-0 overflow-y-auto px-4 pb-4", bodyClassName)}>
              {children}
            </div>
            {footer && <div className="shrink-0 px-4 pt-3 border-t border-border/60">{footer}</div>}
          </m.div>
          </div>
        </m.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default BottomSheet;
