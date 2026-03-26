import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Flame, Trophy, Swords, Shield, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

const Landing = () => {
  const navigate = useNavigate();
  const [demoLoading, setDemoLoading] = useState(false);

  return (
    <div className="min-h-screen gradient-dark flex flex-col overflow-hidden relative">
      {/* Dramatic top light cone */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse at center top, hsl(42 78% 54% / 0.12) 0%, hsl(42 78% 54% / 0.04) 40%, transparent 70%)" }}
      />
      {/* Side vignettes */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 120% 100% at 50% 50%, transparent 50%, hsl(260 18% 2% / 0.8) 100%)" }}
      />

      {/* Header */}
      <header className="relative flex items-center justify-between px-6 pt-6 pb-4 animate-reveal">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl gradient-gold flex items-center justify-center shadow-[0_0_20px_hsl(42_78%_54%/0.3)]">
            <span className="text-sm font-black text-primary-foreground">W</span>
          </div>
          <span className="font-display font-bold text-lg tracking-tight">The W Tracker</span>
        </div>
      </header>

      {/* Hero */}
      <main className="relative flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="animate-reveal max-w-md mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gold/25 bg-gold/8 mb-8 backdrop-blur-sm shadow-[0_0_20px_hsl(42_78%_54%/0.1)]">
            <Flame size={14} className="text-gold" />
            <span className="text-xs font-semibold text-gold tracking-wide">DISCIPLINE IS THE NEW FLEX</span>
          </div>

          <h1 className="font-display text-[2.75rem] sm:text-6xl font-black tracking-tight leading-[0.95] mb-5">
            You either{" "}
            <span className="text-gold glow-gold-text">level up</span>
            <br />
            or fall behind.
          </h1>

          <p className="text-muted-foreground text-lg leading-relaxed max-w-sm mx-auto mb-10">
            The W Tracker turns self-improvement into a visible status game.
            Track your discipline. Compete with others. Earn your status.
            The world sees who puts in the work.
          </p>

          <div className="flex flex-col gap-3 w-full max-w-xs mx-auto animate-reveal animate-reveal-delay-2">
            <Button variant="gold" size="xl" onClick={() => navigate("/auth")} className="w-full group shadow-[0_0_30px_hsl(42_78%_54%/0.2)]">
              Join the Movement
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </Button>
            <Button variant="gold-outline" size="lg" onClick={() => navigate("/auth")}>
              View Leaderboard
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="w-full border-gold/30 text-gold hover:bg-gold/10"
              disabled={demoLoading}
              onClick={async () => {
                setDemoLoading(true);
                try {
                  const { data, error } = await supabase.functions.invoke("demo-login");
                  if (error) throw error;
                  if (data?.access_token && data?.refresh_token) {
                    await supabase.auth.setSession({
                      access_token: data.access_token,
                      refresh_token: data.refresh_token,
                    });
                    localStorage.setItem("w_onboarding_done", "true");
                    navigate("/");
                  } else {
                    throw new Error(data?.error || "Demo login failed");
                  }
                } catch (e: any) {
                  toast.error("Demo login failed. Try again.");
                } finally {
                  setDemoLoading(false);
                }
              }}
            >
              <Play size={16} />
              {demoLoading ? "Loading..." : "Try Demo"}
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
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-gold/15 bg-card/60 backdrop-blur-sm shadow-[0_2px_12px_hsl(0_0%_0%/0.3)]"
            >
              <Icon size={14} className="text-gold" />
              <span className="text-xs font-medium text-foreground">{text}</span>
            </div>
          ))}
        </div>
      </main>

      {/* Bottom tagline */}
      <footer className="relative pb-8 pt-4 text-center animate-reveal animate-reveal-delay-4">
        <p className="text-xs text-muted-foreground tracking-widest uppercase">
          Built for those who refuse to be average
        </p>
      </footer>
    </div>
  );
};

export default Landing;
