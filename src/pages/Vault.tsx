import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Utensils,
  Dumbbell,
  Moon,
  Brain,
  Wind as WindIcon,
  Sparkles,
  Lock,
  ArrowLeft,
  Crown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface VaultCategory {
  id: string;
  title: string;
  tagline: string;
  description: string;
  icon: typeof Utensils;
  accent: string; // hsl(...) string
  gradient: string;
  comingSoon: boolean;
}

const CATEGORIES: VaultCategory[] = [
  {
    id: "recipes",
    title: "Recipes & Easy Meals",
    tagline: "Eat clean, cook fast",
    description:
      "High-protein, real-food recipes you can throw together in minutes — meal prep, snacks, post-workout fuel.",
    icon: Utensils,
    accent: "hsl(142 70% 50%)",
    gradient:
      "linear-gradient(135deg, hsl(142 70% 50% / 0.18), hsl(142 70% 30% / 0.05))",
    comingSoon: true,
  },
  {
    id: "training",
    title: "Workouts & Movement",
    tagline: "Programs you'll actually finish",
    description:
      "Structured programs and standalone sessions with clear movements — strength, conditioning, mobility.",
    icon: Dumbbell,
    accent: "hsl(18 95% 58%)",
    gradient:
      "linear-gradient(135deg, hsl(18 95% 58% / 0.18), hsl(18 95% 30% / 0.05))",
    comingSoon: true,
  },
  {
    id: "recovery",
    title: "Recovery & Sleep",
    tagline: "Repair, then perform",
    description:
      "Sleep protocols, breathwork, mobility flows and protocols to bounce back faster from training and life.",
    icon: Moon,
    accent: "hsl(220 80% 65%)",
    gradient:
      "linear-gradient(135deg, hsl(220 80% 65% / 0.18), hsl(220 80% 30% / 0.05))",
    comingSoon: true,
  },
  {
    id: "mind",
    title: "Mind & Mood",
    tagline: "EFT · EMDR-style · body work",
    description:
      "Tools for stress, anxiety, focus and emotional release — tapping, eye-movement protocols, somatic exercises.",
    icon: Brain,
    accent: "hsl(280 70% 65%)",
    gradient:
      "linear-gradient(135deg, hsl(280 70% 65% / 0.18), hsl(280 70% 30% / 0.05))",
    comingSoon: true,
  },
  {
    id: "nervous-system",
    title: "Nervous System Reset",
    tagline: "Hypnosis & deep regulation",
    description:
      "Guided audio sessions to calm the nervous system, downshift from stress, and rewire stuck patterns.",
    icon: WindIcon,
    accent: "hsl(190 80% 60%)",
    gradient:
      "linear-gradient(135deg, hsl(190 80% 60% / 0.18), hsl(190 80% 30% / 0.05))",
    comingSoon: true,
  },
];

const Vault = () => {
  const navigate = useNavigate();
  const { isPremium, subscriptionLoading } = useAuth();

  // Gate — non-premium → paywall
  useEffect(() => {
    if (subscriptionLoading) return;
    if (!isPremium) navigate("/paywall", { replace: true });
  }, [isPremium, subscriptionLoading, navigate]);

  if (!isPremium) return null;

  return (
    <div className="min-h-screen pb-12 px-4 pt-4 safe-top">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 animate-reveal">
        <button
          onClick={() => navigate(-1)}
          className="h-9 w-9 rounded-full flex items-center justify-center bg-card/70 border border-border/60 backdrop-blur active:scale-95 transition"
          aria-label="Back"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold/10 border border-gold/40">
          <Crown size={11} className="text-gold" strokeWidth={2.6} />
          <span className="text-[10px] font-black tracking-[0.2em] uppercase text-gold">
            Premium
          </span>
        </div>
      </div>

      {/* Hero */}
      <div className="text-center mb-7 animate-reveal animate-reveal-delay-1">
        <div
          className="mx-auto h-16 w-16 rounded-2xl flex items-center justify-center mb-3 gradient-gold glow-gold"
          aria-hidden
        >
          <Sparkles size={28} className="text-primary-foreground" strokeWidth={2.4} />
        </div>
        <h1 className="font-display text-3xl font-black tracking-tight mb-1.5">
          The <span className="text-gold glow-gold-text">Vault</span>
        </h1>
        <p className="text-sm text-muted-foreground max-w-[300px] mx-auto leading-relaxed">
          Your private library of recipes, training, recovery and nervous-system
          tools. New content drops weekly.
        </p>
      </div>

      {/* Coming soon banner */}
      <div className="mb-6 rounded-2xl border border-gold/30 bg-gradient-to-r from-gold/10 via-card/80 to-card px-4 py-3 animate-reveal animate-reveal-delay-2">
        <p className="text-[11px] font-black tracking-wider uppercase text-gold mb-0.5">
          Library opening soon
        </p>
        <p className="text-[12px] text-muted-foreground leading-snug">
          Foundations are live as a Premium member — full content rolls out
          progressively. You're locked in at €17.99/mo.
        </p>
      </div>

      {/* Categories */}
      <div className="space-y-3 animate-reveal animate-reveal-delay-3">
        {CATEGORIES.map((cat) => (
          <VaultCategoryCard key={cat.id} category={cat} />
        ))}
      </div>
    </div>
  );
};

const VaultCategoryCard = ({ category }: { category: VaultCategory }) => {
  const Icon = category.icon;
  return (
    <button
      type="button"
      disabled={category.comingSoon}
      className={cn(
        "group relative w-full text-left rounded-2xl overflow-hidden border border-border/70 bg-card/80",
        "transition-all duration-200 active:scale-[0.99]",
        category.comingSoon
          ? "opacity-95 cursor-default"
          : "hover:border-gold/50 hover:shadow-[0_0_22px_hsl(var(--gold)/0.18)]",
      )}
      style={{ background: category.gradient }}
    >
      <div className="relative p-4 flex items-start gap-3.5">
        <div
          className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0 border"
          style={{
            background: `linear-gradient(135deg, ${category.accent}33, ${category.accent}10)`,
            borderColor: `${category.accent}55`,
            boxShadow: `0 0 18px ${category.accent}30`,
          }}
        >
          <Icon size={22} style={{ color: category.accent }} strokeWidth={2.4} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p
              className="text-[10px] font-black tracking-[0.18em] uppercase"
              style={{ color: category.accent }}
            >
              {category.tagline}
            </p>
            {category.comingSoon && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-background/60 border border-border/60 text-[8.5px] font-black tracking-wider uppercase text-muted-foreground">
                <Lock size={8} strokeWidth={3} />
                Soon
              </span>
            )}
          </div>
          <p className="font-display text-base font-black leading-tight tracking-tight mb-1">
            {category.title}
          </p>
          <p className="text-[12px] text-muted-foreground leading-snug">
            {category.description}
          </p>
        </div>
      </div>
    </button>
  );
};

export default Vault;
