import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, Swords, Users } from "lucide-react";
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm bg-background border-border/60">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Swords size={18} className="text-[hsl(var(--ember))]" />
            <DialogTitle className="font-display font-black">Challenge a tribe</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Total XP earned by all members during the battle decides the winner.
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tribe by name…"
            className="pl-9"
          />
        </div>

        {/* Results */}
        <div className="max-h-48 overflow-y-auto space-y-1">
          {searching && (
            <div className="flex justify-center py-4">
              <Loader2 size={16} className="animate-spin text-muted-foreground" />
            </div>
          )}
          {!searching && query.trim().length >= 2 && results.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">No tribes found.</p>
          )}
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelected(r)}
              className={cn(
                "w-full text-left rounded-lg border p-2.5 transition-all flex items-center gap-2",
                selected?.id === r.id
                  ? "border-[hsl(var(--ember))]/60 bg-[hsl(var(--ember))]/10"
                  : "border-border bg-card/50 hover:border-border/80",
              )}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{r.name}</p>
                <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                  <Users size={11} /> {r.member_count} members · {r.visibility}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Duration */}
        {selected && (
          <div>
            <p className="eyebrow text-muted-foreground mb-2">
              Duration
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {DURATIONS.map((d) => (
                <button
                  key={d.value}
                  onClick={() => setDuration(d.value)}
                  className={cn(
                    "rounded-lg border p-2 text-center transition-all",
                    duration === d.value
                      ? "border-gold bg-gold/10 shadow-[0_0_10px_hsl(var(--gold)/0.3)]"
                      : "border-border bg-card/40 hover:border-border/80",
                  )}
                >
                  <p className="text-xs font-black">{d.label}</p>
                  <p className="text-[10px] text-muted-foreground">{d.sub}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        <Button
          onClick={handleSubmit}
          disabled={!selected || submitting}
          variant="ember"
          className="w-full"
        >
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <Swords size={14} />}
          Send Challenge
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default TribeChallengeModal;
