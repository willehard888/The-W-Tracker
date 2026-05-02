import { useNavigate } from "react-router-dom";
import { ArrowLeft, Crown, Sparkles, Dumbbell, TrendingUp, Calendar, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

const PremiumCoachUpsell = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-full overflow-y-auto safe-top">
      <div className="shrink-0 px-4 pt-3 pb-2 flex items-center justify-between">
        <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft size={18} />
        </Button>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gold/10 border border-gold/40">
          <Crown size={11} className="text-gold" strokeWidth={2.6} />
          <span className="text-[10px] font-black tracking-[0.22em] uppercase text-gold">
            Premium
          </span>
        </div>
        <span className="w-9" />
      </div>

      <div className="px-5 pb-12 pt-2 max-w-md mx-auto w-full">
        {/* Hero */}
        <div className="relative rounded-3xl overflow-hidden border border-gold/45 bg-gradient-to-b from-gold/[0.14] via-card/95 to-card p-6 text-center shadow-[0_30px_80px_-20px_hsl(var(--gold)/0.45)]">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-4 h-48"
            style={{
              background:
                "radial-gradient(ellipse 65% 85% at 50% 100%, hsl(var(--gold) / 0.5) 0%, hsl(var(--gold) / 0.18) 40%, transparent 75%)",
            }}
          />
          <div className="relative">
            <div className="mx-auto mb-3 h-16 w-16 rounded-2xl flex items-center justify-center bg-gradient-to-br from-[hsl(var(--gold-light))] via-gold to-[hsl(var(--gold-dark))] shadow-[0_8px_24px_hsl(var(--gold)/0.5)]">
              <Sparkles size={28} className="text-background" strokeWidth={2.6} />
            </div>
            <p className="text-[10px] font-black tracking-[0.22em] uppercase text-gold mb-1">
              W Coach · Premium
            </p>
            <h1 className="font-display text-[32px] leading-[0.95] font-black tracking-tight mb-2">
              Your digital<br />personal trainer.
            </h1>
            <p className="text-[12.5px] text-muted-foreground max-w-[300px] mx-auto leading-relaxed">
              A 4-week training, recovery and nutrition program designed around your goal —
              and tracked against your real check-in data.
            </p>
          </div>
        </div>

        {/* What's inside */}
        <ul className="mt-5 space-y-2.5">
          <Row
            icon={Dumbbell}
            title="Personalized 4-week program"
            text="Progressive blocks built around your goal, equipment and schedule."
          />
          <Row
            icon={Calendar}
            title="Today's session, every day"
            text="Open the app and your next workout, recovery or rest day is queued."
          />
          <Row
            icon={TrendingUp}
            title="AI progress reads"
            text="Weekly review of compliance, sleep, hydration — with one concrete adjustment."
          />
          <Row
            icon={Sparkles}
            title="Adaptive chat coach"
            text="Ask anything — Coach already knows your active program and last 7 days."
          />
        </ul>

        {/* Mock program preview (blurred) */}
        <div className="mt-6 relative rounded-2xl border border-border/60 bg-card/60 p-4 overflow-hidden">
          <div className="space-y-2 blur-[3px] select-none pointer-events-none">
            {["Mon · Lower body strength · 55 min", "Tue · Zone 2 · 40 min", "Wed · Push focus · 50 min", "Thu · Mobility · 25 min"].map((s) => (
              <div key={s} className="rounded-lg bg-background/40 border border-border/40 px-3 py-2 text-[12px]">
                {s}
              </div>
            ))}
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background/80 border border-gold/40 backdrop-blur-sm">
              <Lock size={12} className="text-gold" />
              <span className="text-[10.5px] font-black tracking-widest uppercase text-gold">
                Locked — go Premium
              </span>
            </span>
          </div>
        </div>

        {/* CTA */}
        <Button
          variant="gold"
          size="xl"
          className="w-full mt-6 font-black h-14 breathing-glow"
          onClick={() => navigate("/paywall")}
        >
          <Crown size={18} strokeWidth={2.8} />
          Unlock Coach with Premium
        </Button>
        <p className="text-[10px] text-muted-foreground/80 text-center mt-2 tracking-wide">
          Cancel anytime · Includes The Vault · New protocols weekly
        </p>
      </div>
    </div>
  );
};

const Row = ({ icon: Icon, title, text }: { icon: any; title: string; text: string }) => (
  <li className="flex items-start gap-3 rounded-xl bg-card/60 border border-border/60 p-3">
    <span className="h-8 w-8 rounded-lg shrink-0 flex items-center justify-center bg-gradient-to-br from-gold/30 to-gold/10 border border-gold/40">
      <Icon size={14} className="text-gold" strokeWidth={2.6} />
    </span>
    <div className="min-w-0">
      <p className="font-bold text-sm leading-tight">{title}</p>
      <p className="text-[11.5px] text-muted-foreground leading-snug mt-0.5">{text}</p>
    </div>
  </li>
);

export default PremiumCoachUpsell;
