import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { BottomSheet } from "@/components/ui/sheet-bottom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { hapticImpact } from "@/lib/haptics";
import {
  EQUIPMENT_VALUES,
  EQUIPMENT_LABEL,
  EQUIPMENT_PRESETS,
  contextLabel,
  type EquipmentValue,
} from "@/lib/training/equipment-context";

/**
 * Where the athlete is training today.
 *
 * The profile says where they usually train and keeps saying it: this changes
 * one day, and only if they ask for it to become the default does it touch the
 * profile at all. Somebody who trains at the gym and is at home once should
 * not have to re-answer onboarding to get a usable session.
 *
 * The counts are shown before committing. Silently rewriting the day somebody
 * is about to train is worse than one line asking them to confirm it.
 */
export const EquipmentContextSheet = ({
  open,
  onClose,
  value,
  preview,
  onApply,
  applying,
}: {
  open: boolean;
  onClose: () => void;
  /** Today's selection, seeded from the profile. */
  value: EquipmentValue[];
  /** What applying a given room would do to the day, computed by the parent. */
  preview: (values: EquipmentValue[]) => { replaced: number; dropped: number };
  onApply: (values: EquipmentValue[], saveAsDefault: boolean) => void;
  applying: boolean;
}) => {
  const [picked, setPicked] = useState<EquipmentValue[]>(value);
  const [saveDefault, setSaveDefault] = useState(false);
  useEffect(() => { if (open) { setPicked(value); setSaveDefault(false); } }, [open, value]);

  const toggle = (v: EquipmentValue) => {
    hapticImpact("light");
    setPicked((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));
  };

  const { replaced, dropped } = preview(picked);
  const unchanged = picked.length === value.length && picked.every((v) => value.includes(v));

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      label="Training today"
      title="Training today"
      subtitle={contextLabel(picked)}
      height="auto"
      footer={
        <div className="space-y-2">
          <Button
            size="lg"
            className="w-full"
            disabled={picked.length === 0 || applying || (unchanged && !saveDefault)}
            onClick={() => onApply(picked, saveDefault)}
          >
            {replaced + dropped > 0
              ? `Use this · ${replaced + dropped} ${replaced + dropped === 1 ? "movement changes" : "movements change"}`
              : "Use this"}
          </Button>
          <button
            type="button"
            onClick={() => { hapticImpact("light"); setSaveDefault((v) => !v); }}
            className="min-h-11 w-full flex items-center justify-center gap-2 text-meta font-bold text-muted-foreground"
          >
            <span
              className={cn(
                "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                saveDefault ? "bg-gold border-gold" : "border-border",
              )}
            >
              {saveDefault && <Check aria-hidden size={11} className="text-primary-foreground" />}
            </span>
            Make this my usual
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {EQUIPMENT_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => { hapticImpact("light"); setPicked([...p.values]); }}
              className="press min-h-11 rounded-full border border-gold/30 bg-gold/12 px-3 text-label font-bold text-gold"
            >
              {p.label}
            </button>
          ))}
        </div>

        <ul className="divide-y divide-border/35 border-y border-border/35">
          {EQUIPMENT_VALUES.map((v) => {
            const on = picked.includes(v);
            return (
              <li key={v}>
                <button
                  type="button"
                  onClick={() => toggle(v)}
                  aria-pressed={on}
                  className="press-row w-full min-h-12 flex items-center gap-2.5 py-2 text-left"
                >
                  <span
                    className={cn(
                      "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                      on ? "bg-gold border-gold" : "border-border",
                    )}
                  >
                    {on && <Check aria-hidden size={11} className="text-primary-foreground" />}
                  </span>
                  <span className={cn("text-note font-bold", on ? "text-foreground" : "text-muted-foreground/75")}>
                    {EQUIPMENT_LABEL[v]}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {dropped > 0 && (
          <p className="text-meta text-muted-foreground/80 leading-relaxed">
            {dropped === 1 ? "One movement has" : `${dropped} movements have`} no equivalent here and
            will be left out rather than swapped for something that does not match.
          </p>
        )}
      </div>
    </BottomSheet>
  );
};

export default EquipmentContextSheet;
