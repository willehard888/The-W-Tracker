import { Sparkles, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { hapticImpact } from "@/lib/haptics";

interface CoachNudgeCardProps {
  nudgeId: string;
  headline: string | null;
  content: string;
}

const CoachNudgeCard = ({ nudgeId, headline, content }: CoachNudgeCardProps) => {
  const navigate = useNavigate();

  const handleTap = async () => {
    hapticImpact("light");
    // Mark as seen, prefill nudge into chat as system context
    await supabase
      .from("coach_nudges")
      .update({ seen_at: new Date().toISOString() })
      .eq("id", nudgeId);
    try {
      sessionStorage.setItem(
        "w_coach_nudge_context",
        JSON.stringify({ headline, content }),
      );
    } catch {}
    navigate("/coach");
  };

  return (
    <motion.button
      type="button"
      onClick={handleTap}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full text-left rounded-2xl glass-card-gold p-4 relative overflow-hidden gradient-border-animated active:scale-[0.99] transition-transform"
    >
      <div
        className="absolute -top-12 -right-12 w-40 h-40 rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, hsl(42 78% 54% / 0.22) 0%, hsl(42 78% 54% / 0.05) 55%, transparent 80%)",
        }}
      />
      <div className="relative flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg gradient-gold flex items-center justify-center shrink-0 float-subtle">
          <Sparkles size={16} className="text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-[10px] uppercase tracking-widest text-gold/80 font-bold">
              Coach
            </p>
          </div>
          {headline && (
            <p className="font-display font-black tracking-tight text-base leading-tight text-foreground mb-1">
              {headline}
            </p>
          )}
          <p className="text-sm text-muted-foreground leading-snug line-clamp-2">
            {content}
          </p>
        </div>
        <ChevronRight size={18} className="text-gold/60 shrink-0 mt-1" />
      </div>
    </motion.button>
  );
};

export default CoachNudgeCard;
