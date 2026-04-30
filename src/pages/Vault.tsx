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
  Clock,
  Flame,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface VaultCategory {
  id: string;
  title: string;
  tagline: string;
  description: string;
  icon: typeof Utensils;
  accent: string; // hsl(...) string
  preview: string[]; // 2-3 sample item titles
  dropLabel: string;
  comingSoon: boolean;
}

const CATEGORIES: VaultCategory[] = [
  {
    id: "recipes",
    title: "Recipes & Easy Meals",
    tagline: "Eat clean · cook fast",
    description:
      "High-protein, real-food recipes you can throw together in minutes. Meal prep, snacks, post-workout fuel — built for busy weeks.",
    icon: Utensils,
    accent: "hsl(142 70% 50%)",
    preview: [
      "10-min high-protein breakfast bowls",
      "One-pan chicken & rice prep",
      "Post-workout shake stack",
    ],
    dropLabel: "First drop · within 2 weeks",
    comingSoon: true,
  },
  {
    id: "training",
    title: "Workouts & Movement",
    tagline: "Programs you'll finish",
    description:
      "Structured 4–8 week programs and standalone sessions with crystal-clear movements. Strength, conditioning, mobility — at home or in the gym.",
    icon: Dumbbell,
    accent: "hsl(18 95% 58%)",
    preview: [
      "Foundational Strength · 6-week",
      "Conditioning sprints · 20-min",
      "Daily mobility flow",
    ],
    dropLabel: "First program · within 3 weeks",
    comingSoon: true,
  },
  {
    id: "recovery",
    title: "Recovery & Sleep",
    tagline: "Repair, then perform",
    description:
      "Sleep protocols, breathwork, mobility flows and recovery rituals to bounce back faster from training and life.",
    icon: Moon,
    accent: "hsl(220 80% 65%)",
    preview: [
      "Wind-down routine · 12 min",
      "Box breathing · 5 min",
      "Sunday recovery flow",
    ],
    dropLabel: "Foundations live within 4 weeks",
    comingSoon: true,
  },
  {
    id: "mind",
    title: "Mind & Mood",
    tagline: "EFT · EMDR-style · body work",
    description:
      "Tools for stress, anxiety, focus and emotional release — tapping sequences, eye-movement protocols and somatic exercises that actually move the needle.",
    icon: Brain,
    accent: "hsl(280 70% 65%)",
    preview: [
      "EFT tapping for anxiety",
      "EMDR-style focus reset",
      "Somatic shake-off (3 min)",
    ],
    dropLabel: "Starter set · within 4 weeks",
    comingSoon: true,
  },
  {
    id: "nervous-system",
    title: "Nervous System Reset",
    tagline: "Hypnosis · deep regulation",
    description:
      "Guided audio sessions to calm an overdriven nervous system, downshift from stress, and rewire stuck patterns. Headphones recommended.",
    icon: WindIcon,
    accent: "hsl(190 80% 60%)",
    preview: [
      "10-min hypnosis · sleep",
      "Vagus nerve reset (audio)",
      "NSDR-style power nap",
    ],
    dropLabel: "First sessions · within 5 weeks",
    comingSoon: true,
  },
];

const Vault = () => {
  const navigate = useNavigate();
  const { isPremium, subscriptionLoading, profile } = useAuth();

  // Gate — non-premium → paywall
  useEffect(() => {
    if (subscriptionLoading) return;
    if (!isPremium) navigate("/paywall", { replace: true });
  }, [isPremium, subscriptionLoading, navigate]);

  if (!isPremium) return null;

  const firstName =
    (profile as any)?.username ||
    (profile as any)?.display_name ||
    null;

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
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold/10 border border-gold/40 shadow-[0_0_18px_hsl(var(--gold)/0.25)]">
          <Crown size={11} className="text-gold" strokeWidth={2.6} />
          <span className="text-[10px] font-black tracking-[0.22em] uppercase text-gold">
            Premium
          </span>
        </div>
      </div>

      {/* Hero — luxe panel */}
      <div className="relative mb-6 animate-reveal animate-reveal-delay-1 overflow-hidden rounded-3xl border border-gold/40 bg-gradient-to-b from-gold/[0.14] via-card/95 to-card shadow-[0_30px_80px_-20px_hsl(var(--gold)/0.45),0_0_60px_hsl(var(--gold)/0.18),inset_0_1px_0_hsl(var(--gold)/0.55)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-4 h-48"
          style={{
            background:
              "radial-gradient(ellipse 65% 85% at 50% 100%, hsl(var(--gold) / 0.5) 0%, hsl(var(--gold) / 0.18) 40%, transparent 75%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay"
          style={{
            backgroundImage:
              "radial-gradient(hsl(var(--gold)) 1px, transparent 1px)",
            backgroundSize: "3px 3px",
          }}
        />

        <div className="relative px-5 pt-7 pb-5 text-center">
          <div className="mx-auto mb-3 relative w-fit">
            <div
              aria-hidden
              className="absolute inset-0 rounded-2xl blur-xl opacity-80"
              style={{
                background:
                  "radial-gradient(circle, hsl(var(--gold)/0.55) 0%, transparent 70%)",
              }}
            />
            <div className="relative h-16 w-16 rounded-2xl flex items-center justify-center bg-gradient-to-br from-[hsl(var(--gold-light))] via-gold to-[hsl(var(--gold-dark))] shadow-[0_8px_24px_hsl(var(--gold)/0.45),inset_0_1px_0_hsl(0_0%_100%/0.4)]">
              <Sparkles size={30} className="text-background" strokeWidth={2.4} />
            </div>
          </div>

          {firstName && (
            <p className="text-[10px] font-black tracking-[0.22em] uppercase text-gold mb-1">
              Welcome in, {firstName}
            </p>
          )}
          <h1 className="font-display text-[34px] leading-[0.95] font-black tracking-tight mb-2">
            The{" "}
            <span className="bg-gradient-to-b from-[hsl(var(--gold-light))] via-gold to-[hsl(var(--gold))] bg-clip-text text-transparent drop-shadow-[0_0_18px_hsl(var(--gold)/0.5)]">
              Vault
            </span>
          </h1>
          <p className="text-[12.5px] text-muted-foreground max-w-[300px] mx-auto leading-relaxed">
            Your private library of recipes, training, recovery, mind work and
            nervous-system tools. Built for the obsessed.
          </p>

          {/* Stat trio */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { label: "Categories", value: "5" },
              { label: "First drop", value: "2 wks" },
              { label: "New / week", value: "Yes" },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl bg-background/50 border border-gold/20 px-2 py-2"
              >
                <p className="font-display text-base font-black text-gold leading-none">
                  {s.value}
                </p>
                <p className="text-[9px] tracking-widest uppercase text-muted-foreground mt-1">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Drop status banner */}
      <div className="mb-5 rounded-2xl border border-gold/25 bg-gradient-to-r from-gold/10 via-card/80 to-card px-4 py-3 animate-reveal animate-reveal-delay-2 flex items-start gap-3">
        <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 bg-gold/15 border border-gold/40">
          <Flame size={16} className="text-gold" strokeWidth={2.6} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-black tracking-wider uppercase text-gold mb-0.5">
            Founding-member access
          </p>
          <p className="text-[12px] text-foreground/85 leading-snug">
            You're in early. New content drops weekly — your price stays locked
            as long as you stay subscribed.
          </p>
        </div>
      </div>

      {/* Categories */}
      <div className="space-y-3 animate-reveal animate-reveal-delay-3">
        {CATEGORIES.map((cat) => (
          <VaultCategoryCard key={cat.id} category={cat} />
        ))}
      </div>

      {/* Footer manage */}
      <div className="mt-8 text-center">
        <p className="text-[10px] tracking-widest uppercase text-muted-foreground/70">
          Premium member · €17.99/mo or yearly
        </p>
      </div>
    </div>
  );
};

const VaultCategoryCard = ({ category }: { category: VaultCategory }) => {
  const Icon = category.icon;
  return (
    <div
      className={cn(
        "group relative w-full text-left rounded-2xl overflow-hidden border border-border/70 bg-card/80",
        "transition-all duration-200",
        "hover:border-gold/40",
      )}
      style={{
        background: `linear-gradient(135deg, ${category.accent}15, hsl(var(--card)) 65%)`,
      }}
    >
      {/* corner glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl opacity-50"
        style={{
          background: `radial-gradient(circle, ${category.accent}55 0%, transparent 70%)`,
        }}
      />

      <div className="relative p-4">
        <div className="flex items-start gap-3.5">
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
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <p
                className="text-[10px] font-black tracking-[0.18em] uppercase"
                style={{ color: category.accent }}
              >
                {category.tagline}
              </p>
              {category.comingSoon && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-background/60 border border-border/60 text-[8.5px] font-black tracking-wider uppercase text-muted-foreground">
                  <Lock size={8} strokeWidth={3} />
                  In production
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

        {/* Sample preview chips */}
        <div className="mt-3 pl-[60px]">
          <p className="text-[9.5px] font-black tracking-[0.18em] uppercase text-muted-foreground/80 mb-1.5">
            What's coming
          </p>
          <ul className="space-y-1">
            {category.preview.map((item) => (
              <li
                key={item}
                className="flex items-center gap-2 text-[11.5px] text-foreground/85"
              >
                <span
                  className="h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ background: category.accent }}
                />
                <span className="font-medium truncate">{item}</span>
              </li>
            ))}
          </ul>

          <div className="mt-2.5 inline-flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase text-muted-foreground/90">
            <Clock size={10} style={{ color: category.accent }} strokeWidth={2.8} />
            <span>{category.dropLabel}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Vault;
