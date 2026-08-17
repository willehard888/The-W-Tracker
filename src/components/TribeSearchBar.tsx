import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Lock, Loader2, Users, Check, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { friendlyError } from "@/lib/error-copy";

interface SearchResult {
  id: string;
  name: string;
  description: string | null;
  visibility: string;
  member_count: number;
  viewer_status: "member" | "pending_join" | "pending_invite" | "none";
}

interface Props {
  onChanged?: () => void;
}

const TribeSearchBar = ({ onChanged }: Props) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const { data, error } = await supabase.rpc("search_tribes" as any, {
        p_query: query.trim(),
        p_limit: 20,
      });
      if (!error && data) setResults(data as any);
      setLoading(false);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const refreshResultStatus = (id: string, status: SearchResult["viewer_status"]) => {
    setResults((arr) => arr.map((r) => (r.id === id ? { ...r, viewer_status: status } : r)));
  };

  const handleAction = async (r: SearchResult) => {
    if (r.viewer_status === "member") {
      navigate(`/tribes/${r.id}`);
      return;
    }
    if (r.viewer_status === "pending_join") return;
    setActingId(r.id);
    const { data, error } = await supabase.rpc("join_tribe" as any, { p_tribe_id: r.id });
    setActingId(null);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    if (data === "pending") {
      toast.success("Request sent — awaiting approval");
      refreshResultStatus(r.id, "pending_join");
    } else if (data === "already_member") {
      toast.info("Already a member");
      refreshResultStatus(r.id, "member");
    } else {
      toast.success("Joined the tribe!");
      refreshResultStatus(r.id, "member");
    }
    onChanged?.();
  };

  const renderActionButton = (r: SearchResult) => {
    if (r.viewer_status === "member") {
      return (
        <Button size="sm" variant="outline" className="h-8 text-[11px]" onClick={() => handleAction(r)}>
          Open
        </Button>
      );
    }
    if (r.viewer_status === "pending_join") {
      return (
        <Button size="sm" variant="outline" disabled className="h-8 text-[11px]">
          <Check size={11} /> Sent
        </Button>
      );
    }
    if (r.viewer_status === "pending_invite") {
      return (
        <Button size="sm" variant="outline" className="h-8 text-[11px]" onClick={() => navigate("/squad?tab=tribes")}>
          Accept invite
        </Button>
      );
    }
    if (r.visibility === "private") {
      return (
        <Button
          size="sm"
          onClick={() => handleAction(r)}
          disabled={actingId === r.id}
          className="h-8 text-[11px] bg-gradient-to-r from-[hsl(var(--ember))] to-gold text-background font-black"
        >
          {actingId === r.id ? <Loader2 size={11} className="animate-spin" /> : <Lock size={11} />}
          Request
        </Button>
      );
    }
    return (
      <Button
        size="sm"
        onClick={() => handleAction(r)}
        disabled={actingId === r.id}
        className="h-8 text-[11px] bg-gradient-to-r from-[hsl(var(--ember))] to-gold text-background font-black"
      >
        {actingId === r.id ? <Loader2 size={11} className="animate-spin" /> : "Join"}
      </Button>
    );
  };

  return (
    <div className="mb-4">
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search all tribes (public & private)"
          className="pl-9 pr-9 h-10 bg-card/60 border-border focus-visible:ring-[hsl(var(--ember))]/40"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {query.trim() && (
        <div className="mt-3 rounded-xl border border-border bg-card/60 overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 size={16} className="animate-spin text-muted-foreground" />
            </div>
          ) : results.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-6">No tribes found.</p>
          ) : (
            <div className="divide-y divide-border/50">
              {results.map((r) => (
                <div
                  key={r.id}
                  className={cn(
                    "p-3 flex items-center gap-3",
                    r.viewer_status === "member" && "cursor-pointer hover:bg-secondary/30",
                  )}
                >
                  <div
                    className={cn(
                      "h-9 w-9 rounded-lg flex items-center justify-center shrink-0 border",
                      r.visibility === "private"
                        ? "bg-secondary/60 border-border"
                        : "bg-[hsl(var(--ember))]/15 border-[hsl(var(--ember))]/30",
                    )}
                  >
                    {r.visibility === "private" ? (
                      <Lock size={14} className="text-muted-foreground" />
                    ) : (
                      <Users size={14} className="text-[hsl(var(--ember))]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-black truncate">{r.name}</p>
                      {r.visibility === "private" && (
                        <span className="text-[8px] px-1 rounded bg-secondary text-muted-foreground font-black uppercase tracking-widest shrink-0">
                          Private
                        </span>
                      )}
                    </div>
                    {r.description && (
                      <p className="text-[10px] text-muted-foreground truncate">{r.description}</p>
                    )}
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                      <Users size={9} /> {r.member_count}
                    </span>
                  </div>
                  {renderActionButton(r)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TribeSearchBar;
