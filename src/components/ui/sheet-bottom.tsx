import type { ReactNode, RefObject } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useScrollLock } from "@/contexts/ScrollContainerContext";
import { cn } from "@/lib/utils";

/**
 * THE bottom sheet. A fixed overlay portalled to <body> with a solid backdrop
 * (Radix portals under transformed ancestors have failed to surface on iOS
 * WKWebView), a spring rise (plain fade under reduced motion), safe-area
 * bottom, drag handle, and one header row: back · title/subtitle · close.
 * Pass no `title` to keep a custom hero as content — the close button then
 * floats top-right. The shell scroller is locked while open (useScrollLock).
 */
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
  const reduced = useReducedMotion();
  const rise = reduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.18 } }
    : { initial: { y: "100%" }, animate: { y: 0 }, exit: { y: "100%" }, transition: { type: "spring" as const, stiffness: 380, damping: 38 } };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={label}
          className="fixed inset-0 z-[var(--z-celebration)] flex flex-col"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Solid backdrop — no backdrop-filter, which iOS WKWebView mis-composites. */}
          <div className="absolute inset-0 bg-black/70" onClick={onClose} aria-hidden />
          <motion.div
            className={cn(
              "relative mt-auto flex flex-col w-full rounded-t-[28px] border-t border-white/10 bg-[hsl(255_14%_7%)] shadow-[0_-20px_60px_-12px_hsl(0_0%_0%/0.7)] overflow-hidden",
              height === "tall" ? "h-[90dvh]" : "max-h-[93vh]",
            )}
            {...rise}
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            <div className="flex justify-center pt-2.5 pb-1 shrink-0">
              <div className="h-1 w-10 rounded-full bg-white/15" />
            </div>
            {title ? (
              <div className="px-3 pt-1 pb-2 flex items-center gap-1 shrink-0">
                {leading ?? (onBack ? (
                  <Button variant="ghost" size="icon" aria-label="Back" className="min-h-11 min-w-11" onClick={onBack}>
                    <ChevronLeft size={20} />
                  </Button>
                ) : (
                  <span className="w-11" aria-hidden />
                ))}
                <div className="flex-1 min-w-0 text-center">
                  <div className="font-display text-[15px] font-black tracking-tight truncate">{title}</div>
                  {subtitle && <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>}
                </div>
                <Button variant="ghost" size="icon" aria-label="Close" className="min-h-11 min-w-11" onClick={onClose}>
                  <X size={20} />
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
                <X size={18} />
              </Button>
            )}
            {headerExtra && <div className="shrink-0">{headerExtra}</div>}
            <div ref={bodyRef} className={cn("flex-1 min-h-0 overflow-y-auto px-4 pb-4", bodyClassName)}>
              {children}
            </div>
            {footer && <div className="shrink-0 px-4 pt-3 border-t border-border/60">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default BottomSheet;
