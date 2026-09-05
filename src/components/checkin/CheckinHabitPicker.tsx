import { useEffect, useMemo, useState } from "react";
import { BottomSheet } from "@/components/ui/sheet-bottom";
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
  // button `will-change: transform`, home-rise) creates a containing block
  // that traps `position: fixed` inside the content area — which clipped the
  // header under the app bar and hid the Save button behind the bottom nav.
  return (
    <BottomSheet
      open={open}
      onClose={() => onOpenChange(false)}
      label="Build your check-in"
      title="Build your check-in"
      subtitle={<>{coreCount} core · {optionalCount} added · bonus max +{OPTIONAL_XP_CAP} XP/day</>}
      footer={
        <Button variant="ember" size="lg" className="w-full" onClick={handleSave}>
          Save my habits
        </Button>
      }
    >
            <div className="pt-3 space-y-6">
              {PILLAR_ORDER.map((pillar) => {
                const habits = grouped.get(pillar);
                if (!habits?.length) return null;
                return (
                  <div key={pillar}>
                    <p className="eyebrow mb-2 text-gold/70">
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
                              "press flex items-center gap-3 w-full rounded-2xl border p-3.5 text-left transition-all ",
                              on ? "border-gold/40 bg-gold/[0.07]" : "border-border bg-card hover:bg-secondary/50",
                            )}
                          >
                            <span className="text-2xl w-9 text-center shrink-0">{h.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className={cn("font-bold text-[15px] truncate", on && "text-gold")}>{h.label}</p>
                                {h.verify && <ShieldCheck aria-hidden size={13} className="text-teal shrink-0" />}
                              </div>
                              {h.note && <p className="text-[12px] text-muted-foreground leading-snug line-clamp-2">{h.note}</p>}
                            </div>
                            {h.core ? (
                              <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground/75 uppercase tracking-wide">
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
              <p className="text-[12px] text-muted-foreground text-center pt-1 pb-2">
                <ShieldCheck aria-hidden size={12} className="inline text-teal mr-1" />
                marked habits can be auto-verified by Apple Health.
              </p>
            </div>
    </BottomSheet>
  );
};

export default CheckinHabitPicker;
