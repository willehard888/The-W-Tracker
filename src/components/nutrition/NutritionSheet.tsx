import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Full-screen bottom sheet for the diary flows (search → portion → miss).
 * Same construction as CheckinHabitPicker, for the same reason: a self-
 * contained fixed overlay portalled to <body> with a solid backdrop cannot
 * fail to surface on iOS WKWebView, where Radix portals + transformed
 * ancestors have. Owns nothing but chrome: title, optional back, close.
 */
const NutritionSheet = ({
  open,
  onClose,
  title,
  onBack,
  label,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  onBack?: () => void;
  /** Accessible name for the dialog. */
  label: string;
  children: ReactNode;
  footer?: ReactNode;
}) => {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

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
          <div className="absolute inset-0 bg-black/70" onClick={onClose} />
          <motion.div
            className="relative mt-auto flex flex-col w-full max-h-[93vh] rounded-t-[28px] border-t border-white/10 bg-[hsl(255_14%_7%)] shadow-[0_-20px_60px_-12px_hsl(0_0%_0%/0.7)] overflow-hidden"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            <div className="flex justify-center pt-2.5 pb-1 shrink-0">
              <div className="h-1 w-10 rounded-full bg-white/15" />
            </div>
            <div className="px-3 pt-1 pb-2 flex items-center gap-1 shrink-0">
              {onBack ? (
                <Button variant="ghost" size="icon" aria-label="Back" className="min-h-11 min-w-11" onClick={onBack}>
                  <ChevronLeft size={20} />
                </Button>
              ) : (
                <span className="w-11" aria-hidden />
              )}
              <div className="flex-1 min-w-0 text-center font-display text-[15px] font-black tracking-tight truncate">{title}</div>
              <Button variant="ghost" size="icon" aria-label="Close" className="min-h-11 min-w-11" onClick={onClose}>
                <X size={20} />
              </Button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">{children}</div>
            {footer && <div className="shrink-0 px-4 pt-3 border-t border-border/60">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default NutritionSheet;
