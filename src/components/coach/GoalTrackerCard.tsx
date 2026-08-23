import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Target, TrendingUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useCoachGoals } from "@/hooks/use-coach-goals";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { hapticImpact } from "@/lib/haptics";
import { friendlyError } from "@/lib/error-copy";

const computePace = (g: { baseline_value: number | null; current_value: number | null; target_value: number; deadline: string | null; created_at: string }) => {
  const baseline = g.baseline_value ?? 0;
  const current = g.current_value ?? baseline;
  const total = g.target_value - baseline;
  const done = current - baseline;
  const pct = total === 0 ? 0 : Math.max(0, Math.min(100, Math.round((done / total) * 100)));

  if (!g.deadline) return { pct, etaText: null as string | null, onPace: true };
  const start = new Date(g.created_at).getTime();
  const end = new Date(g.deadline).getTime();
  const now = Date.now();
  const elapsed = (now - start) / (end - start);
  const expected = Math.max(0, Math.min(1, elapsed)) * 100;
  const onPace = pct + 5 >= expected;
  const daysLeft = Math.max(0, Math.ceil((end - now) / 86400_000));
  return { pct, etaText: `${daysLeft}d left`, onPace };
};

const GoalTrackerCard = () => {
  const { goals, activeGoal, upsert, updateProgress, remove } = useCoachGoals();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title: "", metric: "custom", unit: "", baseline_value: "", target_value: "", deadline: "" });

  const create = async () => {
    if (!draft.title.trim() || !draft.target_value) {
      toast.error("Need a title and target");
      return;
    }
    try {
      await upsert({
        title: draft.title.trim(),
        metric: draft.metric,
        unit: draft.unit,
        baseline_value: draft.baseline_value ? Number(draft.baseline_value) : null,
        current_value: draft.baseline_value ? Number(draft.baseline_value) : null,
        target_value: Number(draft.target_value),
        deadline: draft.deadline || null,
      } as any);
      setDraft({ title: "", metric: "custom", unit: "", baseline_value: "", target_value: "", deadline: "" });
      setAdding(false);
      hapticImpact("light");
      toast.success("Goal locked");
    } catch (e: any) {
      toast.error(friendlyError(e, "Failed"));
    }
  };

  if (!activeGoal && !adding) {
    return (
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="w-full rounded-2xl border border-dashed border-border/50 bg-card/30 px-4 py-4 flex items-center gap-3 hover:border-[hsl(var(--gold)/0.5)] transition"
      >
        <div className="h-9 w-9 rounded-xl bg-[hsl(var(--gold)/0.12)] flex items-center justify-center">
          <Target size={16} className="text-gold" />
        </div>
        <div className="text-left">
          <p className="text-sm font-bold">Set your North Star goal</p>
          <p className="text-[11px] text-muted-foreground">e.g. Bench 100 kg by August.</p>
        </div>
      </button>
    );
  }

  if (adding) {
    return (
      <div className="rounded-2xl border border-border/40 bg-card/50 p-4 space-y-3">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gold">New goal</p>
        <Input placeholder="Title (e.g. Bench 100 kg)" value={draft.title}
          onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} />
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Now" type="number" value={draft.baseline_value}
            onChange={e => setDraft(d => ({ ...d, baseline_value: e.target.value }))} />
          <Input placeholder="Target" type="number" value={draft.target_value}
            onChange={e => setDraft(d => ({ ...d, target_value: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Unit (kg, km…)" value={draft.unit}
            onChange={e => setDraft(d => ({ ...d, unit: e.target.value }))} />
          <Input type="date" value={draft.deadline}
            onChange={e => setDraft(d => ({ ...d, deadline: e.target.value }))} />
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" className="flex-1" onClick={() => setAdding(false)}>Cancel</Button>
          <Button variant="ember" size="sm" className="flex-1" onClick={create}>Lock goal</Button>
        </div>
      </div>
    );
  }

  if (!activeGoal) return null;
  const { pct, etaText, onPace } = computePace(activeGoal);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-[hsl(var(--gold)/0.35)] bg-gradient-to-br from-[hsl(var(--gold)/0.08)] to-card/50 p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gold flex items-center gap-1">
            <Target size={10} /> North Star
          </p>
          <h3 className="font-display text-base font-black mt-0.5 truncate">{activeGoal.title}</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {activeGoal.current_value ?? activeGoal.baseline_value ?? 0}{activeGoal.unit} → {activeGoal.target_value}{activeGoal.unit}
            {etaText && <span className="ml-2">· {etaText}</span>}
          </p>
        </div>
        <span className={cn(
          "text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full",
          onPace ? "bg-xp-green/15 text-xp-green" : "bg-rose-500/15 text-rose-300"
        )}>
          {onPace ? "On pace" : "Off pace"}
        </span>
      </div>

      <div className="mt-3">
        <Progress value={pct} />
        <p className="text-[10px] text-muted-foreground mt-1">{pct}% of the way</p>
      </div>

      <div className="mt-3 flex gap-2">
        <Button variant="ghost" size="sm" className="flex-1"
          onClick={async () => {
            const v = prompt("New current value", String(activeGoal.current_value ?? activeGoal.baseline_value ?? 0));
            if (v == null) return;
            const n = Number(v);
            if (!Number.isFinite(n)) return toast.error("Invalid number");
            await updateProgress({ id: activeGoal.id, value: n });
            hapticImpact("light");
            toast.success("Progress updated");
          }}>
          <TrendingUp size={14} /> Log progress
        </Button>
        <Button variant="ghost" size="icon-sm"
          onClick={async () => {
            if (!confirm("Delete this goal?")) return;
            await remove(activeGoal.id);
          }} aria-label="Delete">
          <Trash2 size={14} />
        </Button>
      </div>

      {goals.filter(g => g.id !== activeGoal.id && g.status === "active").length === 0 && (
        <button type="button"
          onClick={() => setAdding(true)}
          className="mt-3 w-full text-[11px] text-muted-foreground/80 inline-flex items-center justify-center gap-1 hover:text-gold">
          <Plus size={12} /> Add another goal
        </button>
      )}
    </motion.div>
  );
};

export default GoalTrackerCard;
