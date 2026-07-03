import { useEffect, useMemo, useState } from "react";
import { Check, Lock, ShieldCheck, Loader2 } from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { hapticSelection } from "@/lib/haptics";
import {
  CHECKIN_HABITS, PILLAR_LABEL, type CheckinPillar, type CheckinHabit,
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
 * Bottom sheet that lets the user compose THEIR own check-in from the curated,
 * evidence-based habit library. Sleep + Workout are core (locked on). The
 * selection persists via set_checkin_habits.
 */
const CheckinHabitPicker = ({ open, onOpenChange, selectedKeys, onSave, saving }: Props) => {
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
    if (h.core) return; // sleep + workout can't be removed
    hapticSelection();
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(h.key)) next.delete(h.key);
      else next.add(h.key);
      return next;
    });
  };

  const handleSave = async () => {
    // Persist non-core keys only; core is always resolved client-side.
    const keys = CHECKIN_HABITS.filter((h) => !h.core && draft.has(h.key)).map((h) => h.key);
    await onSave(keys);
    onOpenChange(false);
  };

  const selectedCount = CHECKIN_HABITS.filter((h) => h.core || draft.has(h.key)).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[88vh] flex flex-col p-0 gap-0">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border text-left shrink-0">
          <SheetTitle className="font-display text-xl font-black tracking-tight">
            Build your check-in
          </SheetTitle>
          <SheetDescription className="text-sm">
            Pick the habits that matter to <span className="text-gold font-semibold">you</span>.
            Sleep &amp; Workout are always in. {selectedCount} selected.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {PILLAR_ORDER.map((pillar) => {
            const habits = grouped.get(pillar);
            if (!habits?.length) return null;
            return (
              <div key={pillar}>
                <p className="mb-2 text-[11px] font-black tracking-[0.18em] uppercase text-gold/70">
                  {PILLAR_LABEL[pillar]}
                </p>
                <div className="space-y-2">
                  {habits.map((h) => {
                    const on = h.core || draft.has(h.key);
                    return (
                      <button
                        key={h.key}
                        onClick={() => toggle(h)}
                        disabled={h.core}
                        className={cn(
                          "flex items-center gap-3 w-full rounded-xl border p-3 text-left transition-all active:scale-[0.98]",
                          on ? "border-gold/40 bg-gold/5" : "border-border bg-card hover:bg-secondary/50",
                          h.core && "opacity-95",
                        )}
                      >
                        <span className="text-xl w-8 text-center shrink-0">{h.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className={cn("font-semibold text-sm truncate", on && "text-gold")}>{h.label}</p>
                            {h.verify && (
                              <ShieldCheck size={13} className="text-teal shrink-0" />
                            )}
                          </div>
                          {h.note && <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">{h.note}</p>}
                        </div>
                        {h.core ? (
                          <Lock size={15} className="text-muted-foreground/50 shrink-0" />
                        ) : (
                          <div className={cn(
                            "h-5 w-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all",
                            on ? "border-gold bg-gold" : "border-muted-foreground/30",
                          )}>
                            {on && <Check size={12} className="text-primary-foreground" strokeWidth={3} />}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <p className="text-[11px] text-muted-foreground text-center pt-1">
            <ShieldCheck size={12} className="inline text-teal mr-1" />
            marked habits can be auto-verified by Apple Health.
          </p>
        </div>

        <SheetFooter className="px-5 py-4 border-t border-border shrink-0">
          <Button variant="gold" size="lg" className="w-full" onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 size={18} className="animate-spin" /> Saving…</> : "Save my check-in"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default CheckinHabitPicker;
