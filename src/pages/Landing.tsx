import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Flame, Trophy, Swords, Shield } from "lucide-react";
import logo from "@/assets/logo.png";

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen gradient-dark flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 pt-6 pb-4 animate-reveal">
        <div className="flex items-center gap-2">
          <img src={logo} alt="The W Tracker" className="h-9 w-auto" />
          <span className="font-display font-bold text-lg tracking-tight">The W Tracker</span>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="animate-reveal max-w-md mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-gold/20 bg-gold/5 mb-8">
            <Flame size={14} className="text-gold" />
            <span className="text-xs font-semibold text-gold tracking-wide">DISCIPLINE IS THE NEW FLEX</span>
          </div>

          <h1 className="font-display text-5xl sm:text-6xl font-black tracking-tight leading-[0.95] mb-5">
            You either{" "}
            <span className="text-gold glow-gold-text">level up</span>
            <br />
            or fall behind.
          </h1>

          <p className="text-muted-foreground text-base leading-relaxed max-w-sm mx-auto mb-10">
            The W Tracker turns self-improvement into a visible status game.
            Track your discipline. Compete with others. Earn your status.
            The world sees who puts in the work.
          </p>

          <div className="flex flex-col gap-3 w-full max-w-xs mx-auto animate-reveal animate-reveal-delay-2">
            <Button variant="gold" size="xl" onClick={() => navigate("/auth")} className="w-full group">
              Join the Movement
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </Button>
            <Button variant="gold-outline" size="lg" onClick={() => navigate("/auth")}>
              View Leaderboard
            </Button>
          </div>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-3 mt-16 animate-reveal animate-reveal-delay-3">
          {[
            { icon: Flame, text: "Streak System" },
            { icon: Trophy, text: "Status Ranks" },
            { icon: Swords, text: "1v1 Battles" },
            { icon: Shield, text: "Badge Vault" },
          ].map(({ icon: Icon, text }) => (
            <div
              key={text}
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card/50 backdrop-blur-sm"
            >
              <Icon size={14} className="text-gold" />
              <span className="text-xs font-medium text-foreground">{text}</span>
            </div>
          ))}
        </div>
      </main>

      {/* Bottom tagline */}
      <footer className="pb-8 pt-4 text-center animate-reveal animate-reveal-delay-4">
        <p className="text-xs text-muted-foreground tracking-widest uppercase">
          Built for those who refuse to be average
        </p>
      </footer>
    </div>
  );
};

export default Landing;
