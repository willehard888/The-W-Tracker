import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Lock, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { hapticSelection } from "@/lib/haptics";
import {
  CHECKIN_HABITS, PILLAR_LABEL, OPTIONAL_XP_CAP, type CheckinPillar, type CheckinHabit,
} from "@/lib/checkin-habits";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Currently-selected habit keys (core keys may or may not be present). */
  selectedKeys: string[];
  onSave: (keys: string[]) => Promise<unknown>;
  saving?: boolean;
}

const PILLAR_ORDER: CheckinPillar[] = [
  "sleep", "movement", "nutrition", "mind", "recovery", "connection",
];

/**
 * Full-screen habit-library picker. Deliberately a SELF-CONTAINED fixed overlay
 * (not a Radix portal Sheet) — on iOS Capacitor WKWebView the portal + sheet
 * combo could fail to surface, so this renders inline with its own animation and
 * a solid background. It cannot fail to open. Sleep + workout etc. are core
 * (locked on); the rest is the user's personal selection, persisted via
 * set_checkin_habits.
 */
const CheckinHabitPicker = ({ open, onOpenChange, selectedKeys, onSave, saving: _saving }: Props) => {
  const [draft, setDraft] = useState<Set<string>>(new Set(selectedKeys));

  // Re-seed the draft each time the sheet opens so it reflects saved state.
  useEffect(() => {
    if (open) setDraft(new Set(selectedKeys));
  }, [open, selectedKeys]);

  // Lock background scroll while open (smoother, no bleed-through scroll).
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const grouped = useMemo(() => {
    const map = new Map<CheckinPillar, CheckinHabit[]>();
    for (const h of CHECKIN_HABITS) {
      const arr = map.get(h.pillar) ?? [];
      arr.push(h);
      map.set(h.pillar, arr);
    }
    return map;
  }, []);

  const toggle = (h: CheckinHabit) => {
    if (h.core) return; // core habits can't be removed
    hapticSelection();
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(h.key)) next.delete(h.key);
      else next.add(h.key);
      return next;
    });
  };

  const handleSave = () => {
    // Persist non-core keys only; core is always resolved client-side.
    const keys = CHECKIN_HABITS.filter((h) => !h.core && draft.has(h.key)).map((h) => h.key);
    // Optimistic: close instantly — the hook updates the cache in onMutate,
    // retries transient network drops, and on real failure rolls back with a
    // loud toast. (The old `await` + `finally { close() }` swallowed errors:
    // the sheet closed, the selection silently never saved.)
    onOpenChange(false);
    void onSave(keys).catch(() => { /* surfaced by the hook's toast */ });
  };

  const coreCount = CHECKIN_HABITS.filter((h) => h.core).length;
  const optionalCount = CHECKIN_HABITS.filter((h) => !h.core && draft.has(h.key)).length;

  // Portal to <body> so the fixed overlay is viewport-relative. Rendered inline
  // in the page tree, an ancestor's transform / will-change (e.g. the global
  // button `will-change: transform`, animate-reveal) creates a containing block
  // that traps `position: fixed` inside the content area — which clipped the
  // header under the app bar and hid the Save button behind the bottom nav.
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Build your check-in"
          className="fixed inset-0 z-[var(--z-celebration)] flex flex-col"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop — solid (no backdrop-filter, which iOS WKWebView mis-composites) */}
          <div className="absolute inset-0 bg-black/70" onClick={() => onOpenChange(false)} />

          {/* Panel — slides up from the bottom, leaves a peek of backdrop on top */}
          <motion.div
            className="relative mt-auto flex flex-col w-full max-h-[93vh] rounded-t-[28px] border-t border-white/10 bg-[hsl(255_14%_7%)] shadow-[0_-20px_60px_-12px_hsl(0_0%_0%/0.7)] overflow-hidden"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            {/* Grab handle */}
            <div className="flex justify-center pt-2.5 pb-1 shrink-0">
              <div className="h-1 w-10 rounded-full bg-white/15" />
            </div>

            {/* Header */}
            <div className="px-5 pt-1 pb-3 border-b border-border/60 shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-black tracking-tight">Build your check-in</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {coreCount} core · {optionalCount} added
                    <span className="text-muted-foreground/75"> (bonus max +{OPTIONAL_XP_CAP} XP/day)</span>
                  </p>
                </div>
                <button
                  onClick={() => onOpenChange(false)}
                  className="shrink-0 h-9 w-9 -mr-1 flex items-center justify-center rounded-full bg-secondary/70 text-muted-foreground active:scale-90 transition-transform"
                  aria-label="Close"
                >
                  <X aria-hidden size={18} />
                </button>
              </div>
            </div>

            {/* Scrollable habit library */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-6">
              {PILLAR_ORDER.map((pillar) => {
                const habits = grouped.get(pillar);
                if (!habits?.length) return null;
                return (
                  <div key={pillar}>
                    <p className="mb-2 text-[11px] font-black tracking-[0.22em] uppercase text-gold/70">
                      {PILLAR_LABEL[pillar]}
                    </p>
                    <div className="space-y-2">
                      {habits.map((h) => {
                        const on = h.core || draft.has(h.key);
                        return (
                          <button
                            key={h.key}
                            onClick={() => toggle(h)}
                            aria-pressed={on}
                            disabled={h.core}
                            className={cn(
                              "flex items-center gap-3 w-full rounded-2xl border p-3.5 text-left transition-all active:scale-[0.98]",
                              on ? "border-gold/40 bg-gold/[0.07]" : "border-border bg-card hover:bg-secondary/50",
                            )}
                          >
                            <span className="text-2xl w-9 text-center shrink-0">{h.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className={cn("font-bold text-[15px] truncate", on && "text-gold")}>{h.label}</p>
                                {h.verify && <ShieldCheck aria-hidden size={13} className="text-teal shrink-0" />}
                              </div>
                              {h.note && <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">{h.note}</p>}
                            </div>
                            {h.core ? (
                              <span className="shrink-0 inline-flex items-center gap-1 text-[9px] font-bold text-muted-foreground/75 uppercase tracking-wide">
                                <Lock aria-hidden size={11} /> Core
                              </span>
                            ) : (
                              <div className={cn(
                                "h-6 w-6 rounded-full border-2 shrink-0 flex items-center justify-center transition-all",
                                on ? "border-gold bg-gold" : "border-muted-foreground/30",
                              )}>
                                {on && <Check aria-hidden size={13} className="text-primary-foreground" strokeWidth={3} />}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <p className="text-[11px] text-muted-foreground text-center pt-1 pb-2">
                <ShieldCheck aria-hidden size={12} className="inline text-teal mr-1" />
                marked habits can be auto-verified by Apple Health.
              </p>
            </div>

            {/* Footer */}
            <div className="px-5 pt-3 border-t border-border/60 shrink-0">
              <Button variant="ember" size="lg" className="w-full" onClick={handleSave}>
                Save my habits
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default CheckinHabitPicker;
