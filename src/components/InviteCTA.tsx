import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Gift, ChevronRight } from "lucide-react";

interface InviteCTAProps {
  referralCount: number;
}

const MESSAGES = [
  {
    title: "Invite a friend → you both win",
    sub: "They get a 14-day trial, you get +50 XP the moment they join",
  },
  {
    title: "3 paid friends = 1 month free",
    sub: "And another month for every 3 after — no cap",
  },
  {
    title: "Turn your circle into free membership",
    sub: "Every 3 paid friends = 1 month free, forever",
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
      className="w-full rounded-2xl glass-card-gold p-4 text-left transition-transform border border-gold/30 relative overflow-hidden"
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
          <Gift aria-hidden size={18} className="text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="eyebrow text-gold/80 mb-0.5">
            Earn free membership
          </p>
          <p className="font-bold text-sm leading-tight">{message.title}</p>
          <p className="text-[12px] text-muted-foreground mt-0.5 leading-tight">
            {message.sub}
          </p>
        </div>
        <ChevronRight aria-hidden size={18} className="text-gold/60 shrink-0" />
      </div>
    </button>
  );
};

export default InviteCTA;
