import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Gift, ChevronRight } from "lucide-react";

interface InviteCTAProps {
  referralCount: number;
}

const MESSAGES = [
  {
    title: "Invite 1 friend → you both win",
    sub: "They get 14-day trial, you get +50 XP instantly",
  },
  {
    title: "3 paying friends = 1 month free for you",
    sub: "Every referral milestone unlocks credits & badges",
  },
  {
    title: "Turn your network into free membership",
    sub: "10 paying referrals = 6 months free + Founder status",
  },
];

const InviteCTA = ({ referralCount }: InviteCTAProps) => {
  const navigate = useNavigate();

  const message = useMemo(() => {
    // Rotate weekly based on ISO week
    const now = new Date();
    const week = Math.floor(
      (now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) /
        (7 * 24 * 60 * 60 * 1000),
    );
    return MESSAGES[week % MESSAGES.length];
  }, []);

  if (referralCount >= 3) return null;

  return (
    <button
      onClick={() => navigate("/referrals")}
      className="w-full rounded-2xl glass-card-gold p-4 text-left active:scale-[0.99] transition-transform border border-gold/30 relative overflow-hidden"
    >
      <div
        className="absolute -top-12 -right-12 w-32 h-32 rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, hsl(var(--gold) / 0.18) 0%, transparent 70%)",
        }}
      />
      <div className="relative flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl gradient-gold flex items-center justify-center shrink-0 glow-gold">
          <Gift size={18} className="text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-gold/80 font-bold mb-0.5">
            Earn free membership
          </p>
          <p className="font-bold text-sm leading-tight">{message.title}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
            {message.sub}
          </p>
        </div>
        <ChevronRight size={18} className="text-gold/60 shrink-0" />
      </div>
    </button>
  );
};

export default InviteCTA;
