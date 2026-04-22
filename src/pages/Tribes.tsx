import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Users, Plus, Lock, Crown, Loader2, Zap } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Tribe {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  cover_url: string | null;
  visibility: string;
  member_count: number;
  owner_id: string;
}

const Tribes = () => {
  const { profile, isApexSubscriber } = useAuth();
  const navigate = useNavigate();
  const [tribes, setTribes] = useState<Tribe[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"browse" | "mine">("browse");

  const tier = profile?.status_tier;
  const canCreate =
    isApexSubscriber || tier === "apex" || tier === "legend";

  const load = async () => {
    setLoading(true);
    if (tab === "browse") {
      const { data } = await supabase
        .from("tribes" as any)
        .select("*")
        .eq("visibility", "public")
        .order("member_count", { ascending: false })
        .limit(50);
      setTribes((data as any) ?? []);
    } else {
      // My tribes — owned + joined
      const { data: memberships } = await supabase
        .from("tribe_members" as any)
        .select("tribe_id")
        .eq("user_id", profile?.user_id ?? "")
        .eq("status", "active");
      const ids = ((memberships as any) ?? []).map((m: any) => m.tribe_id);
      if (ids.length === 0) {
        setTribes([]);
      } else {
        const { data } = await supabase
          .from("tribes" as any)
          .select("*")
          .in("id", ids);
        setTribes((data as any) ?? []);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    if (profile?.user_id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, profile?.user_id]);

  const handleJoin = async (id: string) => {
    const { data, error } = await supabase.rpc("join_tribe" as any, {
      p_tribe_id: id,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data === "pending") toast.success("Request sent — awaiting approval");
    else if (data === "already_member") toast.info("Already a member");
    else toast.success("Joined the tribe!");
    load();
  };

  return (
    <div className="min-h-full pb-8 px-4 pt-4 safe-top">
      {/* Cinematic hero banner */}
      <div className="relative rounded-3xl mb-6 p-6 overflow-hidden border-2 border-[hsl(18_95%_58%)]/40 bg-gradient-to-br from-[hsl(18_95%_58%)]/15 via-card/85 to-gold/10 apex-aura-large apex-spotlight apex-embers apex-shimmer-sweep">
        <div className="relative z-10 text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-background/40 backdrop-blur-sm border border-[hsl(18_95%_58%)]/60 mb-3 shadow-[0_0_18px_hsl(18_95%_58%/0.5)]">
            <Zap size={11} className="text-[hsl(18_95%_58%)]" strokeWidth={3} fill="currentColor" />
            <span className="text-[10px] font-black tracking-widest uppercase bg-gradient-to-r from-[hsl(18_95%_58%)] to-gold bg-clip-text text-transparent">
              Apex Tribes
            </span>
          </div>
          <h1 className="font-display text-3xl font-black tracking-tight mb-1.5 leading-none">
            <span className="bg-gradient-to-r from-[hsl(18_95%_58%)] via-gold to-[hsl(18_95%_58%)] bg-clip-text text-transparent drop-shadow-[0_0_18px_hsl(18_95%_58%/0.4)]">
              Communities
            </span>
          </h1>
          <p className="text-xs text-foreground/70 max-w-xs mx-auto leading-relaxed">
            Tribes are founded by Apex (top 1%). <span className="text-[hsl(18_95%_58%)] font-semibold">Join one, or lead your own.</span>
          </p>
        </div>
      </div>

      {/* Create CTA */}
      {canCreate ? (
        <Button
          onClick={() => navigate("/tribes/new")}
          className="w-full mb-4 bg-gradient-to-r from-[hsl(18_95%_58%)] to-gold text-background font-black shadow-[0_0_20px_hsl(18_95%_58%/0.4)]"
          size="lg"
        >
          <Plus size={16} /> Create a Tribe
        </Button>
      ) : (
        <div
          className="mb-4 rounded-xl p-4 border border-[hsl(18_95%_58%)]/25 bg-[hsl(18_95%_58%)]/5 flex items-center gap-3"
        >
          <div className="h-9 w-9 rounded-lg bg-[hsl(18_95%_58%)]/15 border border-[hsl(18_95%_58%)]/30 flex items-center justify-center shrink-0">
            <Lock size={14} className="text-[hsl(18_95%_58%)]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-[hsl(18_95%_58%)] tracking-wide">
              Reach Apex to lead your own tribe
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Earn it via top 1% rank, or unlock instantly with Apex.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate("/paywall")}
            className="shrink-0"
          >
            Unlock
          </Button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4 p-1 rounded-xl bg-secondary/40">
        {(["browse", "mine"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 text-xs font-black py-2 rounded-lg uppercase tracking-wider transition-all",
              tab === t
                ? "bg-background text-foreground shadow"
                : "text-muted-foreground"
            )}
          >
            {t === "browse" ? "Browse" : "My Tribes"}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={20} className="animate-spin text-gold" />
        </div>
      ) : tribes.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          {tab === "browse"
            ? "No public tribes yet. Be the first founder."
            : "You haven't joined any tribes yet."}
        </div>
      ) : (
        <div className="space-y-3">
          {tribes.map((t, idx) => (
            <button
              key={t.id}
              onClick={() => navigate(`/tribes/${t.id}`)}
              className="group w-full text-left rounded-2xl p-4 border border-[hsl(18_95%_58%)]/20 bg-gradient-to-br from-card/80 via-card/60 to-[hsl(18_95%_58%)]/5 hover:border-[hsl(18_95%_58%)]/55 hover:shadow-[0_0_24px_hsl(18_95%_58%/0.25)] active:scale-[0.99] transition-all relative overflow-hidden"
              style={{ animationDelay: `${idx * 60}ms` }}
            >
              {/* Subtle hover sweep */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-gradient-to-r from-transparent via-[hsl(18_95%_58%)]/8 to-transparent" />

              <div className="relative flex items-start gap-3">
                <div className="relative h-14 w-14 rounded-xl bg-gradient-to-br from-[hsl(18_95%_58%)]/30 via-gold/15 to-[hsl(18_95%_58%)]/20 border border-[hsl(18_95%_58%)]/45 flex items-center justify-center shrink-0 shadow-[0_0_14px_hsl(18_95%_58%/0.3)]">
                  <Crown size={20} className="text-[hsl(18_95%_58%)] drop-shadow-[0_0_6px_hsl(18_95%_58%/0.7)]" strokeWidth={2.4} />
                  {/* tiny zap accent */}
                  <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-gradient-to-br from-[hsl(18_95%_58%)] to-gold border border-background flex items-center justify-center shadow-[0_0_6px_hsl(18_95%_58%/0.7)]">
                    <Zap size={8} className="text-background" strokeWidth={3} fill="currentColor" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-black text-base truncate leading-tight">{t.name}</p>
                  {t.description && (
                    <p className="text-[11px] text-muted-foreground/90 line-clamp-2 mt-0.5 leading-snug">
                      {t.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[hsl(18_95%_58%)]/10 border border-[hsl(18_95%_58%)]/25">
                      <Users size={9} className="text-[hsl(18_95%_58%)]" />
                      <span className="text-[10px] font-bold tabular-nums text-[hsl(18_95%_58%)]">
                        {t.member_count}
                      </span>
                    </span>
                    {t.visibility === "private" && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-secondary/60 border border-border">
                        <Lock size={8} className="text-muted-foreground" />
                        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                          Private
                        </span>
                      </span>
                    )}
                  </div>
                </div>
                {tab === "browse" && (
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleJoin(t.id);
                    }}
                    className="bg-gradient-to-r from-[hsl(18_95%_58%)] to-gold text-background font-black shrink-0 shadow-[0_0_12px_hsl(18_95%_58%/0.4)]"
                  >
                    Join
                  </Button>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Tribes;
