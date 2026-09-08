import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomSheet } from "@/components/ui/sheet-bottom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, Search, Swords, Users } from "lucide-react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-copy";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  challengerTribeId: string;
  onCreated?: () => void;
}

interface TribeRow {
  id: string;
  name: string;
  member_count: number;
  visibility: string;
}

const DURATIONS = [
  { value: 3, label: "3 days", sub: "Sprint" },
  { value: 7, label: "7 days", sub: "Standard" },
  { value: 14, label: "14 days", sub: "Marathon" },
] as const;

const TribeChallengeModal = ({ open, onOpenChange, challengerTribeId, onCreated }: Props) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TribeRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<TribeRow | null>(null);
  const [duration, setDuration] = useState<3 | 7 | 14>(7);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setSelected(null);
      setDuration(7);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // active-guard: clearTimeout can't recall an in-flight request, and a
    // slow stale response must not overwrite a newer query's results.
    let active = true;
    const t = setTimeout(async () => {
      const q = query.trim();
      if (q.length < 2) {
        setResults([]);
        return;
      }
      setSearching(true);
      const { data } = await supabase
        .from("tribes")
        .select("id, name, member_count, visibility")
        .ilike("name", `%${q}%`)
        .neq("id", challengerTribeId)
        .order("member_count", { ascending: false })
        .limit(10);
      if (!active) return;
      setResults(data ?? []);
      setSearching(false);
    }, 300);
    return () => { active = false; clearTimeout(t); };
  }, [query, open, challengerTribeId]);

  const handleSubmit = async () => {
    if (!selected) return;
    setSubmitting(true);
    const { error } = await supabase.rpc("create_tribe_battle", {
      p_challenger_tribe_id: challengerTribeId,
      p_opponent_tribe_id: selected.id,
      p_duration_days: duration,
    });
    setSubmitting(false);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    toast.success(`Challenge sent to ${selected.name}`);
    onCreated?.();
    onOpenChange(false);
  };

  return (
    <BottomSheet
      open={open}
      onClose={() => onOpenChange(false)}
      label="Challenge a tribe"
      title="Challenge a tribe"
      subtitle="Total XP earned by all members during the battle decides the winner."
      height="tall"
      headerExtra={
        <div className="relative px-4 pb-2">
          <Search size={14} className="absolute left-7 top-[22px] -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tribe by name…"
            className="pl-9 h-11"
          />
        </div>
      }
      footer={
        <Button
          onClick={handleSubmit}
          disabled={!selected}
          loading={submitting}
          variant="ember"
          size="lg"
          className="w-full"
        >
          <Swords size={14} /> Send challenge
        </Button>
      }
    >
      {searching ? (
        <p className="text-xs text-muted-foreground text-center py-6">Searching…</p>
      ) : query.trim().length >= 2 && results.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">No tribes found.</p>
      ) : (
        <div className="divide-y divide-border/35">
          {results.map((r) => {
            const on = selected?.id === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelected(r)}
                aria-pressed={on}
                className="press w-full min-h-11 text-left py-2.5 flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-bold truncate", on && "text-gold")}>{r.name}</p>
                  <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1 tabular-nums">
                    <Users size={11} aria-hidden /> {r.member_count} members · {r.visibility}
                  </p>
                </div>
                {on && <Check size={16} className="commit-pop text-gold shrink-0" aria-hidden />}
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <div className="mt-4">
          <p className="text-[11px] font-bold text-muted-foreground mb-2">Duration</p>
          <div className="grid grid-cols-3 gap-1.5">
            {DURATIONS.map((d) => (
              <Button
                key={d.value}
                type="button"
                variant={duration === d.value ? "gold-outline" : "outline"}
                className="min-h-11 h-auto py-2 flex-col gap-0"
                onClick={() => setDuration(d.value)}
              >
                <span className="text-xs font-black">{d.label}</span>
                <span className="text-[10px] font-normal text-muted-foreground">{d.sub}</span>
              </Button>
            ))}
          </div>
        </div>
      )}
    </BottomSheet>
  );
};

export default TribeChallengeModal;
