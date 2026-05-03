import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { hapticImpact } from "@/lib/haptics";
import { dailyPlaybookPicks } from "@/lib/coach-faq";

interface BriefPayload {
  ribbon: string;
  brief_md: string;
  prescriptions: { label: string; value: string }[];
  suggested_questions: string[];
  session_focus?: string | null;
  week?: number;
}

interface Props {
  onAsk: (q: string) => void;
}

const fetchBrief = async (force = false): Promise<BriefPayload | null> => {
  const { data, error } = await supabase.functions.invoke("coach-daily-brief", {
    body: { force },
  });
  if (error) throw error;
  return (data?.brief as BriefPayload) ?? null;
};

const TrainerBrief = ({ onAsk }: Props) => {
  const { user } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const [refreshing, setRefreshing] = useState(false);

  const query = useQuery({
    queryKey: ["coach-daily-brief", user?.id, today],
    enabled: !!user?.id,
    queryFn: () => fetchBrief(false),
    staleTime: 1000 * 60 * 30,
  });

  const refresh = async () => {
    hapticImpact("medium");
    setRefreshing(true);
    try {
      const next = await fetchBrief(true);
      if (next) query.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  if (query.isLoading) {
    return (
      <div className="rounded-3xl border border-gold/20 bg-gradient-to-b from-gold/[0.05] to-transparent p-5 mb-3">
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          <Loader2 size={14} className="animate-spin text-gold" />
          Coach is reviewing your week…
        </div>
      </div>
    );
  }

  const brief = query.data;
  if (!brief) {
    return (
      <div className="rounded-3xl border border-border/40 p-5 mb-3 text-xs text-muted-foreground">
        Coach is offline today. Pull to refresh.
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="relative mb-3"
    >
      {/* Ambient gold haze — ties this card into the app's flame language */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-4 -top-6 h-32 opacity-70"
        style={{
          background: "radial-gradient(60% 100% at 50% 0%, hsl(42 78% 54% / 0.18), transparent 70%)",
        }}
      />

      <div className="relative">
        {/* Ribbon */}
        <div className="flex items-center justify-between mb-2 px-1">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gold/90">
            {brief.ribbon}
          </p>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            aria-label="Regenerate brief"
            className="text-muted-foreground/60 hover:text-gold transition-colors p-1"
          >
            <RefreshCw size={12} className={cn(refreshing && "animate-spin")} />
          </button>
        </div>

        {/* Brief body */}
        <div className="rounded-3xl border border-gold/25 bg-gradient-to-b from-[hsl(42_78%_54%/0.06)] via-card/95 to-card p-5 shadow-[0_24px_60px_-30px_hsl(42_78%_54%/0.5)]">
          <div className="flex items-start gap-3 mb-3">
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[hsl(42_88%_62%)] to-[hsl(42_78%_42%)] flex items-center justify-center shrink-0 shadow-[0_0_14px_hsl(42_78%_54%/0.6)]">
              <Sparkles size={15} className="text-[hsl(260_18%_4%)]" />
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-foreground/70">W Coach</p>
              <p className="text-[10px] text-muted-foreground/70">your trainer · today</p>
            </div>
          </div>

          <div className="prose prose-invert prose-sm max-w-none prose-p:my-1.5 prose-p:leading-relaxed prose-strong:text-gold text-[14.5px] text-foreground/95">
            <ReactMarkdown>{brief.brief_md}</ReactMarkdown>
          </div>

          {brief.prescriptions?.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-2">
              {brief.prescriptions.slice(0, 3).map((p, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-border/40 bg-background/40 p-2.5 text-center"
                >
                  <p className="text-[8.5px] font-black uppercase tracking-widest text-muted-foreground/80 truncate">
                    {p.label}
                  </p>
                  <p className="text-[12px] font-black text-gold mt-0.5 leading-tight">{p.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Suggested questions */}
        {brief.suggested_questions?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 px-0.5">
            {brief.suggested_questions.slice(0, 3).map((q, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { hapticImpact("light"); onAsk(q); }}
                className="text-[11px] px-3 py-1.5 rounded-full border border-gold/25 bg-gold/[0.04] text-foreground/80 hover:bg-gold/[0.1] hover:border-gold/40 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Playbook — instant, curated answers */}
        <div className="mt-3 px-0.5">
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground/70 mb-1.5">
            Playbook · instant answers
          </p>
          <div className="flex flex-wrap gap-1.5">
            {dailyPlaybookPicks(3).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => { hapticImpact("light"); onAsk(f.question); }}
                className="text-[11px] px-3 py-1.5 rounded-full border border-border/40 bg-card/60 text-foreground/80 hover:border-gold/40 hover:bg-gold/[0.08] transition-colors"
              >
                {f.question}
              </button>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default TrainerBrief;
