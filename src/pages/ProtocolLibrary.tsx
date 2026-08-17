import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Search, Filter, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { hapticImpact } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import {
  PROTOCOLS,
  PILLARS,
  type PillarId,
  type Protocol,
} from "@/lib/wellness-framework";
import EvidenceChip from "@/components/coach/EvidenceChip";
import ProtocolSheet from "@/components/coach/ProtocolSheet";
import { useAthleteProfile } from "@/hooks/use-athlete-profile";
import { useUserHabits } from "@/hooks/use-user-habits";
import { recommendHabitsForGoal, goalLabel } from "@/lib/coach/recommend-habits";

const PILLAR_ORDER: PillarId[] = ["sleep", "movement", "nutrition", "stress", "recovery", "connection"];

const ProtocolLibrary = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Honor ?pillar=<id> from deep-link callers (StateCard "Fill →" chip
  // jumps here pre-filtered). Falls back to "all" if absent or invalid.
  const initialPillar: PillarId | "all" = (() => {
    const p = searchParams.get("pillar");
    if (p && PILLAR_ORDER.includes(p as PillarId)) return p as PillarId;
    return "all";
  })();
  const [pillar, setPillar] = useState<PillarId | "all">(initialPillar);
  const [strongOnly, setStrongOnly] = useState(false);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Protocol | null>(null);

  // Goal-driven recommendations sit at the top of the list when no
  // pillar filter is active. Hides automatically once the user filters
  // (they're already drilling into one pillar, no need for a 2nd ranker).
  const { profile: athlete } = useAthleteProfile();
  const { habits } = useUserHabits();
  const recommended = useMemo(() => {
    if (pillar !== "all" || q.trim() || strongOnly) return [];
    return recommendHabitsForGoal(athlete?.primary_goal, {
      excludeProtocolIds: habits.map((h) => h.protocol_id),
      limit: 6,
    });
  }, [athlete?.primary_goal, habits, pillar, q, strongOnly]);

  // Sync if URL changes while mounted (deep-link from other Coach card).
  useEffect(() => {
    const p = searchParams.get("pillar");
    if (p && PILLAR_ORDER.includes(p as PillarId)) setPillar(p as PillarId);
  }, [searchParams]);

  const filtered = useMemo(() => {
    return PROTOCOLS.filter((p) => {
      if (pillar !== "all" && p.pillar !== pillar) return false;
      if (strongOnly && p.evidence !== "strong") return false;
      if (q.trim()) {
        const t = q.trim().toLowerCase();
        if (
          !p.title.toLowerCase().includes(t) &&
          !p.benefit.toLowerCase().includes(t) &&
          !p.id.toLowerCase().includes(t)
        ) return false;
      }
      return true;
    });
  }, [pillar, strongOnly, q]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-4 pt-3 pb-3 flex items-center justify-between border-b border-border/30 bg-background">
        <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft size={18} />
        </Button>
        <div className="text-center">
          <h1 className="font-display text-sm font-black tracking-tight leading-none">Protocol Library</h1>
          <p className="text-[9px] text-gold tracking-widest uppercase mt-0.5">Evidence-graded</p>
        </div>
        <span className="w-9" />
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Search */}
        <div className="px-4 pt-4 pb-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search protocols, e.g. sleep, Z2, sauna…"
              className="pl-9 h-10 rounded-xl bg-card/60 border-border/50"
            />
          </div>
        </div>

        {/* Pillar chips */}
        <div className="px-3 pb-2 overflow-x-auto no-scrollbar">
          <div className="flex gap-1.5 min-w-max px-1">
            <PillarChip
              active={pillar === "all"}
              onClick={() => { hapticImpact("light"); setPillar("all"); }}
              label="All"
              emoji="✦"
            />
            {PILLAR_ORDER.map((id) => {
              const p = PILLARS[id];
              return (
                <PillarChip
                  key={id}
                  active={pillar === id}
                  onClick={() => { hapticImpact("light"); setPillar(id); }}
                  label={p.name}
                  emoji={p.emoji}
                />
              );
            })}
          </div>
        </div>

        {/* Strong-evidence toggle */}
        <div className="px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter size={12} className="text-muted-foreground" />
            <span className="text-[11px] font-bold">Strong-evidence only</span>
          </div>
          <Switch checked={strongOnly} onCheckedChange={setStrongOnly} />
        </div>

        {/* Goal-driven recommendations — only on the unfiltered default view.
            Cuts the new-user "wall of 60 protocols" overwhelm. */}
        {recommended.length > 0 && (
          <div className="px-4 pt-2 pb-3">
            <div className="rounded-2xl border border-gold/30 bg-gradient-to-b from-gold/[0.06] to-card p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles size={12} className="text-gold" />
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gold">
                  Recommended for {goalLabel(athlete?.primary_goal).toLowerCase()}
                </p>
              </div>
              <div className="space-y-1.5">
                {recommended.map((p) => {
                  const meta = PILLARS[p.pillar];
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { hapticImpact("light"); setOpen(p); }}
                      className={cn(
                        "w-full text-left rounded-xl border bg-card/60 px-3 py-2 active:scale-[0.99]",
                        meta.tint.border,
                      )}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={cn("text-[9px] font-black uppercase tracking-wider", meta.tint.text)}>
                          {meta.emoji} {meta.name}
                        </span>
                        <EvidenceChip evidence={p.evidence} />
                      </div>
                      <p className="font-bold text-[13px] leading-tight">{p.title}</p>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground/85 leading-snug pt-1">
                Picked by your athletic goal + evidence tier. Tap to read & adopt.
              </p>
            </div>
          </div>
        )}

        {/* List */}
        <div className="px-4 pb-8 pt-2 space-y-2">
          {recommended.length > 0 && (
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground/70 px-1 pt-2">
              All protocols
            </p>
          )}
          {filtered.length === 0 && (
            <p className="text-center text-[12px] text-muted-foreground py-12">
              Nothing matches. Loosen the filters.
            </p>
          )}
          {filtered.map((p) => {
            const meta = PILLARS[p.pillar];
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => { hapticImpact("light"); setOpen(p); }}
                className={cn(
                  "w-full text-left rounded-2xl border bg-card/60 p-3.5 transition-all hover:bg-card/80 active:scale-[0.99]",
                  meta.tint.border,
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className={cn("text-[10px] font-black uppercase tracking-[0.22em]", meta.tint.text)}>
                      {meta.emoji} {meta.name}
                    </span>
                    <EvidenceChip evidence={p.evidence} />
                  </div>
                </div>
                <p className="font-bold text-[14px] leading-tight mb-0.5">{p.title}</p>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  {p.dose.summary}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <ProtocolSheet
        protocol={open}
        open={!!open}
        onOpenChange={(v) => !v && setOpen(null)}
      />
    </div>
  );
};

const PillarChip = ({
  active, onClick, label, emoji,
}: { active: boolean; onClick: () => void; label: string; emoji: string }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "shrink-0 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.22em] border transition-all whitespace-nowrap",
      active
        ? "bg-gradient-to-b from-[hsl(42_88%_62%)] to-[hsl(42_78%_48%)] text-[hsl(260_18%_4%)] border-transparent shadow-[0_2px_8px_-1px_hsl(var(--gold)/0.45)]"
        : "bg-card/40 border-border/50 text-muted-foreground/80 hover:text-foreground",
    )}
  >
    <span className="mr-1">{emoji}</span>{label}
  </button>
);

export default ProtocolLibrary;
