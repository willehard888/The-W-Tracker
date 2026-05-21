import { Send, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { hapticImpact } from "@/lib/haptics";

/**
 * Inline chat CTA at the bottom of the Coach scroll.
 *
 * - Elite: triggers parent's chat-open callback (opens ChatSheet)
 * - Free:  taps to /paywall (chat is Premium-gated server-side anyway)
 *
 * Not a fixed-bottom pinned bar — that's what made old Coach feel like
 * a sub-app. Inline card matches every other W destination's CTA pattern.
 */
const AskCoachPill = ({ onOpenChat }: { onOpenChat: () => void }) => {
  const { isElite } = useAuth();
  const navigate = useNavigate();

  const onTap = () => {
    hapticImpact("light");
    if (isElite) onOpenChat();
    else navigate("/paywall");
  };

  return (
    <button
      type="button"
      onClick={onTap}
      className="mt-2 w-full text-left rounded-3xl border border-gold/35 bg-gradient-to-b from-gold/[0.08] via-card/95 to-card p-4 shadow-[0_18px_56px_-30px_hsl(var(--gold)/0.45)] active:scale-[0.99] transition-transform"
      aria-label={isElite ? "Open W Coach chat" : "Unlock W Coach chat"}
    >
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-gold to-[hsl(42_78%_42%)] flex items-center justify-center shrink-0 shadow-[0_0_18px_hsl(42_78%_54%/0.4)]">
          {isElite
            ? <Send size={16} className="text-[hsl(260_18%_4%)]" strokeWidth={2.6} />
            : <Lock size={14} className="text-[hsl(260_18%_4%)]" strokeWidth={2.6} />
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gold/85 mb-0.5">
            {isElite ? "Ask your coach" : "W Coach chat · Premium"}
          </p>
          <p className="text-[13px] font-bold text-foreground leading-tight">
            {isElite
              ? "Training, sleep, mind — anything on your mind."
              : "Personal coach in your pocket. Unlock to chat."}
          </p>
        </div>
      </div>
    </button>
  );
};

export default AskCoachPill;
