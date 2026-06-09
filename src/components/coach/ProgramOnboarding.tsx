import { forwardRef, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Sparkles, Zap, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { hapticImpact, hapticNotification } from "@/lib/haptics";
import { useAthleteProfile } from "@/hooks/use-athlete-profile";

interface Props { onGenerated: () => void }

const DRAFT_KEY = "w_coach_program_brief_v2";

const FOCUS = ["Chest", "Back", "Legs", "Shoulders", "Arms", "Core", "Glutes", "Conditioning"];

const GOAL_LABEL: Record<string, string> = {
  all: "All-around",
  strength: "Raw strength",
  hypertrophy: "Build muscle",
  fat_loss: "Fat loss",
  endurance: "Endurance",
  longevity: "Longevity",
  focus: "Sharpen focus",
};

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"]; // Sun..Sat

const loadDraft = (): any | null => {
  try { const raw = localStorage.getItem(DRAFT_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
};

const ProgramOnboarding = ({ onGenerated }: Props) => {
  const navigate = useNavigate();
  const { profile } = useAthleteProfile();
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState<any>(() => loadDraft() ?? { bodyFocus: [] as string[], notes: "" });

  useEffect(() => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch {} }, [draft]);

  const toggleFocus = (f: string) => {
    hapticImpact("light");
    const arr: string[] = draft.bodyFocus ?? [];
    setDraft({ ...draft, bodyFocus: arr.includes(f) ? arr.filter(x => x !== f) : [...arr, f] });
  };

  const goalLabel = GOAL_LABEL[profile?.primary_goal ?? "all"] ?? "All-around";
  const days = profile?.training_days_pref ?? [1, 2, 4, 5];
  const sessionMin = profile?.preferred_session_length_min ?? 45;
  const equipment = (profile?.equipment ?? []).join(", ") || "Bodyweight";
  const injuries = profile?.injuries ?? [];
  const horizon = profile?.target_horizon_weeks ?? 12;

  const generate = async () => {
    setGenerating(true);
    hapticImpact("medium");
    try {
      const { data, error } = await supabase.functions.invoke("coach-generate-program", {
        body: {
          body_focus: draft.bodyFocus,
          block_notes: draft.notes,
        },
      });
      if (error) {
        // supabase-js collapses any non-2xx into a generic "non-2xx status
        // code" message and hides the response body — dig out the real reason.
        // Read the body as TEXT first (a gateway timeout returns non-JSON, so
        // .json() throws and we'd otherwise lose the real cause), then try to
        // parse it. Prefix the HTTP status so 504 (timeout) is unmistakable.
        let reason = error.message;
        const ctx = (error as any).context;
        if (ctx && typeof ctx.text === "function") {
          try {
            const raw = (await ctx.text())?.trim();
            if (raw) {
              try { reason = JSON.parse(raw)?.error || raw; }
              catch { reason = raw.slice(0, 200); }
            }
          } catch { /* keep generic */ }
        }
        const status = ctx?.status ? `[${ctx.status}] ` : "";
        throw new Error(`${status}${reason}`);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      hapticNotification("success");
      toast.success("Your personal block is ready.");
      onGenerated();
    } catch (e: any) {
      hapticNotification("error");
      const msg: string = e?.message ?? "";
      // Program generation is a Premium feature — route there instead of
      // showing a dead-end error toast.
      if (/premium/i.test(msg)) {
        toast.error("Personal program building is a Premium feature.", {
          action: { label: "Unlock", onClick: () => navigate("/paywall") },
        });
      } else {
        toast.error(msg || "Couldn't generate program. Try again.");
      }
    } finally {
      setGenerating(false);
    }
  };

  if (generating) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-6">
        <div className="relative mb-6">
          <div aria-hidden className="absolute inset-0 rounded-full blur-2xl"
            style={{ background: "radial-gradient(circle, hsl(var(--gold)/0.55) 0%, transparent 70%)" }} />
          <div className="relative h-20 w-20 rounded-3xl flex items-center justify-center bg-gradient-to-br from-[hsl(var(--gold-light))] via-gold to-[hsl(var(--gold-dark))] shadow-[0_8px_28px_hsl(var(--gold)/0.5)]">
            <Sparkles size={32} className="text-background animate-pulse" strokeWidth={2.6} />
          </div>
        </div>
        <h2 className="font-display text-2xl font-black mb-2">Coach is designing your block</h2>
        <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
          Tailoring 4 progressive weeks to your goal, body, schedule and last 30 days. ~25 seconds.
        </p>
        <Loader2 size={20} className="animate-spin text-gold mt-6" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-5 pt-2 pb-8">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles size={14} className="text-gold" />
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gold">Coach briefing</p>
      </div>
      <h2 className="font-display text-2xl font-black tracking-tight leading-tight">Design my next block</h2>
      <p className="text-sm text-muted-foreground mt-1 mb-5">
        Coach already knows you. Just confirm and add anything specific to this 4-week block.
      </p>

      <div className="rounded-2xl border border-[hsl(var(--gold)/0.3)] bg-gradient-to-b from-[hsl(var(--gold)/0.06)] to-card/40 p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-black tracking-[0.18em] uppercase text-gold">From your athlete profile</p>
          <button type="button" onClick={() => navigate("/coach/profile")}
            className="text-[10px] font-bold text-muted-foreground inline-flex items-center gap-1 hover:text-foreground transition">
            <Settings2 size={11} /> Edit
          </button>
        </div>
        <dl className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-xs">
          <Row k="Goal"      v={goalLabel} />
          <Row k="Horizon"   v={`${horizon} weeks`} />
          <Row k="Schedule"  v={`${days.length} days/wk`} extra={<DayDots active={days} />} />
          <Row k="Session"   v={`${sessionMin} min`} />
          <Row k="Equipment" v={equipment} wide />
          {injuries.length > 0 && <Row k="Injuries" v={injuries.join(", ")} wide />}
        </dl>
      </div>

      <Field label="Body emphasis (optional)">
        <div className="flex flex-wrap gap-1.5">
          {FOCUS.map(f => (
            <Chip key={f} active={draft.bodyFocus.includes(f)} onClick={() => toggleFocus(f)}>{f}</Chip>
          ))}
        </div>
      </Field>

      <div className="mt-5">
        <Field label="Anything new this block? (optional)">
          <textarea
            value={draft.notes}
            onChange={e => setDraft({ ...draft, notes: e.target.value.slice(0, 200) })}
            placeholder="e.g. travel week 3, lower-back tweak, want more conditioning"
            rows={3}
            className="w-full resize-none rounded-2xl border border-border/50 bg-card/60 px-3.5 py-3 text-sm focus:outline-none focus:border-gold/60 focus:ring-1 focus:ring-gold/30"
          />
          <p className="text-[10px] text-muted-foreground/70 mt-1 text-right">{(draft.notes ?? "").length}/200</p>
        </Field>
      </div>

      <Button variant="ember" size="lg" className="w-full mt-6" onClick={generate}>
        <Zap size={16} /> Design my block
      </Button>
      <p className="text-[10px] text-muted-foreground/70 text-center mt-3">
        Coach will use your profile, last 30 days of check-ins, and recent reflections to personalize every session.
      </p>
    </div>
  );
};

const Row = ({ k, v, wide, extra }: { k: string; v: string; wide?: boolean; extra?: React.ReactNode }) => (
  <div className={cn("flex flex-col gap-0.5", wide && "col-span-2")}>
    <dt className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">{k}</dt>
    <dd className="text-foreground/90 font-medium flex items-center gap-2">{v}{extra}</dd>
  </div>
);

const DayDots = ({ active }: { active: number[] }) => (
  <span className="inline-flex gap-0.5 ml-1">
    {DAY_LETTERS.map((l, i) => (
      <span key={i} className={cn(
        "w-3.5 h-3.5 rounded-[5px] text-[8px] font-black flex items-center justify-center",
        active.includes(i) ? "bg-[hsl(var(--gold)/0.8)] text-background" : "bg-card/60 text-muted-foreground/50",
      )}>{l}</span>
    ))}
  </span>
);

const Field = forwardRef<HTMLDivElement, { label: string; children: React.ReactNode }>(
  ({ label, children }, ref) => (
    <div ref={ref}>
      <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">{label}</label>
      {children}
    </div>
  ),
);
Field.displayName = "Field";

const Chip = forwardRef<HTMLButtonElement, { active: boolean; onClick: () => void; children: React.ReactNode }>(
  ({ active, onClick, children }, ref) => (
    <button ref={ref} type="button" onClick={onClick}
      className={cn(
        "rounded-full border transition-all px-3 py-1.5 text-xs",
        active
          ? "border-[hsl(var(--gold))] bg-[hsl(var(--gold)/0.12)] text-[hsl(var(--gold))] font-bold"
          : "border-border/40 bg-card/40 text-muted-foreground"
      )}>
      {children}
    </button>
  ),
);
Chip.displayName = "Chip";

export default ProgramOnboarding;
