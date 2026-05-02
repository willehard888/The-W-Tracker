import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Plus, Check, Loader2, ShieldAlert, BookOpen, Sparkles, Clock } from "lucide-react";
import { toast } from "sonner";
import { hapticImpact, hapticNotification } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import {
  PILLARS,
  EVIDENCE_META,
  type Protocol,
} from "@/lib/wellness-framework";
import EvidenceChip from "./EvidenceChip";
import { useUserHabits } from "@/hooks/use-user-habits";

interface Props {
  protocol: Protocol | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Optional: if AI gave a personalized "why this for you today". */
  why?: string | null;
}

const ProtocolSheet = ({ protocol, open, onOpenChange, why }: Props) => {
  const { habits, addHabit } = useUserHabits();
  const [busy, setBusy] = useState(false);

  if (!protocol) return null;
  const pillar = PILLARS[protocol.pillar];
  const evMeta = EVIDENCE_META[protocol.evidence];
  const alreadyAdded = habits.some((h) => h.protocol_id === protocol.id);
  const atCap = habits.length >= 5;

  const onAdd = async () => {
    hapticImpact("medium");
    setBusy(true);
    try {
      await addHabit(protocol.id);
      hapticNotification("success");
      toast.success("Added to your habits", { description: protocol.title });
    } catch (e: any) {
      const msg = e?.message ?? "Couldn't add habit.";
      if (msg === "cap_reached") toast.error("Max 5 active habits — archive one first.");
      else if (msg === "already_active") toast.info("Already in your habits.");
      else if (msg === "premium_required") toast.error("Premium required.");
      else toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl border-t-2 max-h-[88vh] overflow-y-auto p-0"
      >
        {/* Header band, pillar-tinted */}
        <div className={cn("relative px-5 pt-5 pb-4 bg-gradient-to-b", pillar.tint.glow)}>
          <SheetHeader className="text-left space-y-2">
            <div className="flex items-center gap-2">
              <span className={cn("text-[10px] font-black uppercase tracking-[0.22em]", pillar.tint.text)}>
                {pillar.emoji} {pillar.name}
              </span>
              <EvidenceChip evidence={protocol.evidence} size="sm" />
            </div>
            <SheetTitle className="font-display text-2xl font-black tracking-tight leading-tight">
              {protocol.title}
            </SheetTitle>
          </SheetHeader>
        </div>

        <div className="px-5 pb-6 space-y-4">
          {/* Why this for you today */}
          {why && (
            <div className="rounded-2xl border border-gold/35 bg-gold/[0.08] p-3.5">
              <div className="flex items-center gap-1.5 mb-1">
                <Sparkles size={11} className="text-gold" />
                <p className="text-[9.5px] font-black uppercase tracking-[0.22em] text-gold">
                  Why this — for you, today
                </p>
              </div>
              <p className="text-[13px] leading-snug text-foreground/90">{why}</p>
            </div>
          )}

          {/* Dose */}
          <Block icon={Clock} label="Dose">
            <p className="text-[13.5px] font-bold text-foreground/95">{protocol.dose.summary}</p>
            {(protocol.dose.frequency_per_week || protocol.dose.duration_min) && (
              <p className="text-[11px] text-muted-foreground mt-1">
                {protocol.dose.duration_min ? `${protocol.dose.duration_min} min` : null}
                {protocol.dose.duration_min && protocol.dose.frequency_per_week ? " · " : null}
                {protocol.dose.frequency_per_week
                  ? `${protocol.dose.frequency_per_week}×/week`
                  : null}
                {protocol.dose.time_of_day ? ` · best ${protocol.dose.time_of_day}` : null}
              </p>
            )}
          </Block>

          {/* Benefit */}
          <Block icon={Check} label="Expected benefit">
            <p className="text-[13px] leading-snug text-foreground/90">{protocol.benefit}</p>
          </Block>

          {/* Risk */}
          <Block icon={ShieldAlert} label="Risk / who should be careful">
            <p className="text-[13px] leading-snug text-foreground/85">{protocol.risk}</p>
          </Block>

          {/* Evidence */}
          <div className={cn("rounded-2xl border p-3.5", evMeta.chip.replace("text-", "border-").split(" ")[0])}>
            <div className="flex items-center gap-2 mb-1">
              <EvidenceChip evidence={protocol.evidence} size="sm" />
            </div>
            <p className="text-[12px] text-muted-foreground leading-snug">{evMeta.description}</p>
          </div>

          {/* Citations */}
          {protocol.citations.length > 0 && (
            <Block icon={BookOpen} label="Anchor references">
              <ul className="space-y-1">
                {protocol.citations.map((c) => (
                  <li key={c} className="text-[11.5px] text-muted-foreground leading-snug">
                    • {c}
                  </li>
                ))}
              </ul>
            </Block>
          )}

          {/* Add to habits */}
          <div className="pt-2">
            {alreadyAdded ? (
              <Button variant="ember-glass" size="lg" disabled className="w-full">
                <Check size={14} /> In your habits
              </Button>
            ) : (
              <Button
                variant="gold"
                size="lg"
                loading={busy}
                disabled={atCap}
                onClick={onAdd}
                className="w-full font-black"
              >
                <Plus size={14} /> {atCap ? "Habit cap reached (5)" : "Add to my habits"}
              </Button>
            )}
            <p className="text-[10px] text-muted-foreground/70 text-center mt-2 italic">
              Educational guidance — not medical advice.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

const Block = ({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) => (
  <div>
    <div className="flex items-center gap-1.5 mb-1">
      <Icon size={11} className="text-muted-foreground" />
      <p className="text-[9.5px] font-black uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
    </div>
    {children}
  </div>
);

export default ProtocolSheet;
