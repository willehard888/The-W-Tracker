import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Plus, Check, ShieldAlert, BookOpen, Sparkles, Clock, X } from "lucide-react";
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

/**
 * ProtocolSheet — bottom drawer that shows protocol detail + Add-to-habits.
 *
 * Implementation NOTE: this used to be a Radix `<Sheet>` with backdrop-blur,
 * but iOS Capacitor's WKWebView would intermittently render the overlay as
 * a solid black rectangle with no content (a known WebKit + backdrop-filter
 * compositor bug when stacked over complex paint). We now use a hand-rolled
 * Framer Motion drawer + portal — same pattern as the Coach ChatSheet which
 * has shipped to TestFlight without rendering issues.
 *
 * - Portal renders into document.body so z-index isolation always works.
 * - Backdrop is a solid black/0.55 (no backdrop-filter).
 * - Drawer is `bg-background` (the page surface), not a glass material, so
 *   there's no risk of "transparent over nothing = looks black."
 */
const ProtocolSheet = ({ protocol, open, onOpenChange, why }: Props) => {
  const { habits, addHabit } = useUserHabits();
  const [busy, setBusy] = useState(false);

  // Lock body scroll while open — otherwise the page underneath
  // scrolls when the drawer scrolls, which on iOS feels wrong.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Server-side / SSR guard for the portal.
  if (typeof document === "undefined") return null;

  const alreadyAdded = protocol
    ? habits.some((h) => h.protocol_id === protocol.id)
    : false;
  const atCap = habits.length >= 8;

  const onAdd = async () => {
    if (!protocol) return;
    hapticImpact("medium");
    setBusy(true);
    try {
      await addHabit(protocol.id);
      hapticNotification("success");
      toast.success("Added to your habits", { description: protocol.title });
      onOpenChange(false);
    } catch (e: any) {
      const msg = e?.message ?? "Couldn't add habit.";
      if (msg === "cap_reached") toast.error("Max 8 active habits — archive one first.");
      else if (msg === "already_active") toast.info("Already in your habits.");
      else if (msg === "premium_required") toast.error("Premium required.");
      else toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop — solid (no blur) so iOS WebView never paints black */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[100] bg-black/55"
            onClick={() => onOpenChange(false)}
            aria-hidden
          />

          {/* Drawer — slides up from bottom */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
            className="fixed inset-x-0 bottom-0 z-[110] max-h-[88vh] flex flex-col bg-background border-t border-gold/25 rounded-t-3xl shadow-[0_-20px_60px_-12px_rgba(0,0,0,0.6)]"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          >
            {/* Drag handle */}
            <div className="shrink-0 flex items-center justify-center pt-2 pb-1">
              <span className="h-1 w-9 rounded-full bg-foreground/20" aria-hidden />
            </div>

            {/* Close button (absolute) */}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="absolute right-3 top-4 z-10 h-8 w-8 rounded-full bg-card/70 border border-border/40 flex items-center justify-center text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <X size={14} />
            </button>

            {!protocol ? (
              <div className="px-5 py-12 text-center">
                <p className="text-sm font-bold mb-2">Protocol unavailable</p>
                <p className="text-xs text-muted-foreground">
                  This protocol is no longer in the library. Tap close and browse the current library.
                </p>
              </div>
            ) : (
              <ProtocolBody
                protocol={protocol}
                why={why}
                alreadyAdded={alreadyAdded}
                atCap={atCap}
                busy={busy}
                onAdd={onAdd}
              />
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
};

const ProtocolBody = ({
  protocol, why, alreadyAdded, atCap, busy, onAdd,
}: {
  protocol: Protocol;
  why?: string | null;
  alreadyAdded: boolean;
  atCap: boolean;
  busy: boolean;
  onAdd: () => void;
}) => {
  const pillar = PILLARS[protocol.pillar];
  const evMeta = EVIDENCE_META[protocol.evidence];

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header band, pillar-tinted */}
      <div className={cn("relative px-5 pt-3 pb-4 bg-gradient-to-b", pillar.tint.glow)}>
        <div className="space-y-2 text-left">
          <div className="flex items-center gap-2">
            <span className={cn("text-[10px] font-black uppercase tracking-[0.22em]", pillar.tint.text)}>
              {pillar.emoji} {pillar.name}
            </span>
            <EvidenceChip evidence={protocol.evidence} size="sm" />
          </div>
          <h2 className="font-display text-2xl font-black tracking-tight leading-tight">
            {protocol.title}
          </h2>
        </div>
      </div>

      <div className="px-5 pb-6 space-y-4">
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

        <Block icon={Check} label="Expected benefit">
          <p className="text-[13px] leading-snug text-foreground/90">{protocol.benefit}</p>
        </Block>

        <Block icon={ShieldAlert} label="Risk / who should be careful">
          <p className="text-[13px] leading-snug text-foreground/85">{protocol.risk}</p>
        </Block>

        <div className={cn("rounded-2xl border p-3.5", evMeta.chip.replace("text-", "border-").split(" ")[0])}>
          <div className="flex items-center gap-2 mb-1">
            <EvidenceChip evidence={protocol.evidence} size="sm" />
          </div>
          <p className="text-[12px] text-muted-foreground leading-snug">{evMeta.description}</p>
        </div>

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
              <Plus size={14} /> {atCap ? "Habit cap reached (8)" : "Add to my habits"}
            </Button>
          )}
          <p className="text-[10px] text-muted-foreground/70 text-center mt-2 italic">
            Educational guidance — not medical advice.
          </p>
        </div>
      </div>
    </div>
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
