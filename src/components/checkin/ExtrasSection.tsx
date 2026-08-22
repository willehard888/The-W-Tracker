import Hint from "@/components/ui/hint";
import { Camera, Check, ShieldCheck, SlidersHorizontal, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { hapticSelection } from "@/lib/haptics";
import MediaPreview from "@/components/media/MediaPreview";
import { PROOF_BONUS_XP } from "@/lib/checkin-xp";
import type { CheckinHabit } from "@/lib/checkin-habits";

interface ExtrasSectionProps {
  habits: CheckinHabit[];
  done: (key: string) => boolean;
  onToggle: (key: string) => void;
  isDetected: (h: CheckinHabit) => boolean;
  earned: number;
  cap: number;
  onCustomize: () => void;
  /** First run: one quiet line explaining these are theirs to shape. */
  showFirstRun: boolean;
  onDismissFirstRun: () => void;
  proofFile: File | null;
  proofPreview: string | null;
  onProofChange: (file: File) => void;
  onProofClear: () => void;
}

/**
 * YOUR EXTRAS — optional, self-chosen, and honest about the money: every
 * extra used to advertise "+20/+25/+30 XP" while one shared +40 cap silently
 * swallowed the excess. Now the section header shows the live pool and the
 * rows show WHY the habit matters instead.
 */
const ExtrasSection = (p: ExtrasSectionProps) => (
  <section className="mb-5">
    <div className="flex items-center justify-between gap-3 mb-2 px-0.5">
      <p className="eyebrow">Your extras · optional</p>
      <div className="flex items-center gap-2">
        <span className={cn("text-[11px] font-bold tabular-nums", p.earned > 0 ? "text-gold" : "text-muted-foreground/70")}>
          +{p.earned} / {p.cap} XP
        </span>
        <button
          type="button"
          onClick={() => { hapticSelection(); p.onCustomize(); }}
          aria-label="Customize extras"
          className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors active:scale-95"
        >
          <SlidersHorizontal size={12} /> Edit
        </button>
      </div>
    </div>
    <Hint beat="xp" className="mb-2.5 px-0.5">One shared pool — up to +{p.cap} XP a day, however many you tick.</Hint>

    {p.showFirstRun && (
      <div className="mb-2.5 surface-card p-3 flex items-start gap-2.5">
        <Sparkles size={14} className="text-gold mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground flex-1">
          These are your extras — keep, swap or add habits that matter to you.
        </p>
        <button onClick={p.onDismissFirstRun} className="text-[11px] font-bold text-muted-foreground/70 hover:text-foreground shrink-0">Got it</button>
      </div>
    )}

    <div className="space-y-2">
      {p.habits.map((h) => {
        const active = p.done(h.key);
        return (
          <button
            key={h.key}
            onClick={() => { hapticSelection(); p.onToggle(h.key); }}
            className={cn(
              "group relative flex items-center gap-3 w-full rounded-2xl border p-3 text-left transition-all duration-200 active:scale-[0.985]",
              active
                ? "border-gold/45 bg-gradient-to-r from-gold/[0.12] to-gold/[0.04] shadow-[0_0_0_1px_hsl(var(--gold)/0.15),0_4px_14px_-6px_hsl(var(--gold)/0.35)]"
                : "border-border bg-card hover:bg-secondary/50",
            )}
          >
            <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[20px] transition-colors", active ? "bg-gold/15" : "bg-secondary")}>
              {h.emoji}
            </span>
            <div className="flex-1 min-w-0">
              <p className={cn("font-bold text-[14px] leading-tight flex items-center gap-1.5", active ? "text-gold" : "text-foreground")}>
                {h.label}
                {p.isDetected(h) && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-teal bg-teal/12 px-1.5 py-0.5 rounded-full"><ShieldCheck size={10} /> Detected</span>
                )}
              </p>
              {h.note && <p className="text-[11px] text-muted-foreground leading-snug line-clamp-1 mt-0.5">{h.note}</p>}
            </div>
            <div className={cn(
              "h-6 w-6 rounded-full border-2 transition-all duration-200 shrink-0 flex items-center justify-center",
              active ? "border-gold bg-gold shadow-[0_0_10px_-1px_hsl(var(--gold)/0.6)]" : "border-muted-foreground/30 group-active:border-muted-foreground/50",
            )}>
              {active && <Check size={14} className="text-primary-foreground" strokeWidth={3} />}
            </div>
          </button>
        );
      })}

      {/* Proof photo — uncapped flat bonus, so its XP is honest to show */}
      <div>
        <label className={cn(
          "flex items-center gap-3 w-full rounded-2xl border border-dashed p-3 transition-colors active:scale-[0.985] cursor-pointer",
          p.proofFile ? "border-gold/45 bg-gold/[0.06]" : "border-gold/30 hover:bg-gold/5",
        )}>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/10 text-gold"><Camera size={18} /></div>
          <div className="text-left flex-1 min-w-0">
            <p className="font-bold text-[14px]">Proof photo</p>
            <p className="text-[11px] text-muted-foreground">Camera or gallery · posts to your feed</p>
          </div>
          <span className="text-[11px] font-bold text-gold tabular-nums">+{PROOF_BONUS_XP} XP{p.proofFile ? " ✓" : ""}</span>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            hapticSelection();
            p.onProofChange(file);
          }} />
        </label>
        {p.proofPreview && (
          <MediaPreview imageSrc={p.proofPreview} sizeBytes={p.proofFile?.size} onClear={p.onProofClear} />
        )}
      </div>
    </div>
  </section>
);

export default ExtrasSection;
