import { Send } from "lucide-react";
import { hapticImpact } from "@/lib/haptics";

/**
 * Inline chat CTA on the Coach page. The whole app is paywalled, so every
 * member gets the live, data-aware W Coach chat — no secondary Elite gate.
 * onBrowseFaq is kept for call-site compatibility but defaults to chat.
 */
const AskCoachPill = ({ onOpenChat }: { onOpenChat: () => void; onBrowseFaq?: () => void }) => {
  return (
    <button
      type="button"
      onClick={() => { hapticImpact("light"); onOpenChat(); }}
      className="w-full text-left rounded-3xl border border-gold/35 bg-gradient-to-b from-gold/[0.08] via-card/95 to-card p-4 shadow-[0_18px_56px_-30px_hsl(var(--gold)/0.45)] active:scale-[0.99] transition-transform"
      aria-label="Open W Coach chat"
    >
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-gold to-[hsl(42_78%_42%)] flex items-center justify-center shrink-0 shadow-[0_0_18px_hsl(var(--gold)/0.4)]">
          <Send size={16} className="text-[hsl(260_18%_4%)]" strokeWidth={2.6} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gold/85 mb-0.5">
            Ask your coach
          </p>
          <p className="text-[13px] font-bold text-foreground leading-tight">
            Training, sleep, mind — anything on your mind.
          </p>
        </div>
      </div>
    </button>
  );
};

export default AskCoachPill;
