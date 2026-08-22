import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Flame, Zap, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Internal gallery for previewing every Button variant side-by-side
 * with hover and pressed states visible at a glance.
 *
 * Route: /button-gallery (dev/internal)
 */

type VariantId =
  | "default"
  | "ember"
  | "destructive"
  | "outline"
  | "secondary"
  | "ghost"
  | "gold-outline"
  | "gold-soft"
  | "ember-outline"
  | "ember-glass";

interface VariantSpec {
  id: VariantId;
  label: string;
  group: "Hero" | "Premium" | "Identity" | "Outline & Glass" | "Utility";
  description: string;
  icon?: React.ReactNode;
}

const VARIANTS: VariantSpec[] = [
  { id: "ember", label: "Ember", group: "Hero", description: "The primary CTA — molten amber.", icon: <Flame /> },
  { id: "default", label: "Default", group: "Premium", description: "Same look as ember — the shared primary.", icon: <Sparkles /> },
  { id: "destructive", label: "Destructive", group: "Identity", description: "Flat red — irreversible actions.", icon: <Zap /> },
  { id: "outline", label: "Outline", group: "Outline & Glass", description: "Clean hairline, transparent." },
  { id: "secondary", label: "Secondary", group: "Outline & Glass", description: "Flat translucent surface — most used." },
  { id: "ghost", label: "Ghost", group: "Outline & Glass", description: "Transparent, subtle hover." },
  { id: "gold-outline", label: "Gold Outline", group: "Outline & Glass", description: "Hairline gold, fills lightly on hover." },
  { id: "gold-soft", label: "Gold Soft", group: "Outline & Glass", description: "Premium gold-glass for cancel/compare actions." },
  { id: "ember-outline", label: "Ember Outline", group: "Outline & Glass", description: "Hairline ember for secondary tribe actions." },
  { id: "ember-glass", label: "Ember Glass", group: "Outline & Glass", description: "Ember-tinted glass for fire-context actions." },
];

const GROUPS: VariantSpec["group"][] = [
  "Hero",
  "Premium",
  "Identity",
  "Outline & Glass",
  "Utility",
];

const ButtonGallery = () => {
  const [picked, setPicked] = useState<VariantId | null>(null);

  return (
    <div className="min-h-full pb-24 px-4 pt-4 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          to="/"
          className="h-9 w-9 rounded-full bg-secondary border border-border/40 flex items-center justify-center text-foreground hover:bg-secondary/80 transition-colors active:scale-95"
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="min-w-0">
          <h1 className="text-lg font-display font-bold tracking-tight">Button Gallery</h1>
          <p className="text-xs text-muted-foreground">
            Hover to see live state · Tap to mark as your pick
          </p>
        </div>
      </div>

      {picked && (
        <div className="mb-5 rounded-xl border border-[hsl(var(--gold)/0.35)] bg-[hsl(var(--gold)/0.06)] px-3 py-2 text-xs">
          <span className="text-muted-foreground">Picked: </span>
          <span className="font-bold text-[hsl(var(--gold-light))]">{picked}</span>
        </div>
      )}

      {GROUPS.map((group) => {
        const items = VARIANTS.filter((v) => v.group === group);
        if (items.length === 0) return null;
        return (
          <section key={group} className="mb-7">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.22em] text-[hsl(var(--gold-soft))] mb-3 px-1">
              {group}
            </h2>
            <div className="space-y-3">
              {items.map((spec) => (
                <VariantRow
                  key={spec.id}
                  spec={spec}
                  isPicked={picked === spec.id}
                  onPick={() => setPicked(spec.id)}
                />
              ))}
            </div>
          </section>
        );
      })}

      <p className="mt-8 text-[10px] text-muted-foreground/60 text-center px-4 leading-relaxed">
        Compare hover (mouse over) and pressed (mouse down/touch) states. The
        third column is permanently disabled to show the inert state.
      </p>
    </div>
  );
};

interface VariantRowProps {
  spec: VariantSpec;
  isPicked: boolean;
  onPick: () => void;
}

const VariantRow = ({ spec, isPicked, onPick }: VariantRowProps) => {
  return (
    <div
      className={`rounded-2xl border p-3 transition-colors ${
        isPicked
          ? "border-[hsl(var(--gold)/0.55)] bg-[hsl(var(--gold)/0.04)]"
          : "border-border/40 bg-card/40"
      }`}
    >
      <div className="flex items-baseline justify-between mb-2 px-0.5">
        <span className="text-sm font-bold text-foreground">{spec.label}</span>
        <code className="text-[10px] text-muted-foreground/70 font-mono">{spec.id}</code>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3 px-0.5 leading-snug">
        {spec.description}
      </p>

      {/* State preview row: idle / pressed-sim / disabled */}
      <div className="grid grid-cols-3 gap-2 mb-2.5">
        <StateCell label="Idle">
          <Button
            variant={spec.id}
            size="sm"
            className="w-full"
            onClick={(e) => {
              e.preventDefault();
              onPick();
            }}
          >
            {spec.icon}
            <span>Tap</span>
          </Button>
        </StateCell>

        <StateCell label="Pressed">
          {/* Force the active state via class — simulates mouse-down look */}
          <Button
            variant={spec.id}
            size="sm"
            className="w-full pointer-events-none [&]:scale-[0.985] [&]:brightness-[0.94]"
            tabIndex={-1}
          >
            {spec.icon}
            <span>Tap</span>
          </Button>
        </StateCell>

        <StateCell label="Disabled">
          <Button variant={spec.id} size="sm" className="w-full" disabled>
            {spec.icon}
            <span>Tap</span>
          </Button>
        </StateCell>
      </div>

      {/* Live larger CTA — easiest to feel the variant's character */}
      <Button
        variant={spec.id}
        size="lg"
        className="w-full"
        onClick={(e) => {
          e.preventDefault();
          onPick();
        }}
      >
        {spec.icon}
        <span>Hover & press me</span>
      </Button>
    </div>
  );
};

const StateCell = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70 font-semibold text-center">
      {label}
    </span>
    {children}
  </div>
);

export default ButtonGallery;
