import { useEffect, useState } from "react";
import RealisticFlame from "@/components/home/RealisticFlame";
import FlameDevPanel from "@/components/dev/FlameDevPanel";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import {
  flameEdgeMaskImage,
  flameSharpenFilter,
  useEffectiveFlameSettings,
} from "@/lib/flame-dev-settings";

/**
 * Flame Editor — pelkistetty Home-näkymä liekin reaaliaikaiseen säätämiseen.
 *
 * Keskellä iso liekki mustalla kankaalla, alla pikasäätimet (tier, koko, accent).
 * Oikeassa alakulmassa Flame Dev Panel pakotettuna auki tarkempaan finetuneen.
 */

const ACCENT_PRESETS: { label: string; value: string }[] = [
  { label: "Ember", value: "hsl(18 95% 58%)" },
  { label: "Gold", value: "hsl(42 85% 60%)" },
  { label: "Crimson", value: "hsl(350 85% 58%)" },
  { label: "Cyan", value: "hsl(190 90% 60%)" },
  { label: "Violet", value: "hsl(280 80% 65%)" },
  { label: "Lime", value: "hsl(95 80% 55%)" },
];

const Index = () => {
  const [tier, setTier] = useState(4);
  const [size, setSize] = useState(280);
  const [accent, setAccent] = useState(ACCENT_PRESETS[0].value);
  const { effective: flameSettings, fps, degraded } = useEffectiveFlameSettings();

  // Force the dev panel open whenever this editor is mounted, so the user can
  // always reach the deep settings without typing ?devflame=1 in the URL.
  useEffect(() => {
    try {
      localStorage.setItem("flameDevPanel", "1");
    } catch {
      /* noop */
    }
  }, []);

  return (
    <div className="h-full w-full relative overflow-hidden bg-black text-foreground">
      {/* Stage — pure black canvas so the flame is the only light source */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 55%, hsl(0 0% 6%) 0%, hsl(0 0% 1.5%) 70%, #000 100%)",
        }}
      />

      {/* Header */}
      <div className="absolute top-0 inset-x-0 z-20 px-4 pt-4 safe-top flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[hsl(18_95%_58%)]">
            Flame Editor
          </p>
          <p className="text-[10px] text-muted-foreground/70 mt-0.5">
            Säädä asetuksia reaaliajassa
          </p>
        </div>
        <span
          className={cn(
            "text-[10px] font-black tabular-nums px-2 py-1 rounded-md border",
            degraded
              ? "text-[hsl(0_85%_62%)] border-[hsl(0_85%_62%/0.4)] bg-[hsl(0_85%_62%/0.1)]"
              : "text-[hsl(140_80%_55%)] border-[hsl(140_80%_55%/0.4)] bg-[hsl(140_80%_55%/0.1)]",
          )}
          title={degraded ? "Auto-degrade aktiivinen" : "Sujuva renderöinti"}
        >
          {fps} FPS
        </span>
      </div>

      {/* Flame stage — centered, isolated for filter/blend correctness */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          style={{
            width: size,
            height: size * 1.4,
            isolation: "isolate",
            filter: flameSharpenFilter(flameSettings),
            WebkitMaskImage: flameSettings.edgeClipping
              ? flameEdgeMaskImage(flameSettings.edgeSoftness)
              : undefined,
            maskImage: flameSettings.edgeClipping
              ? flameEdgeMaskImage(flameSettings.edgeSoftness)
              : undefined,
          }}
          className="relative flex items-end justify-center"
        >
          <RealisticFlame tier={tier} accent={accent} size={size} interactive />
        </div>
      </div>

      {/* Bottom quick-controls dock */}
      <div
        className="absolute inset-x-0 bottom-0 z-20 px-4 pb-6 pt-4 space-y-4"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)",
          background:
            "linear-gradient(180deg, transparent 0%, hsl(0 0% 0% / 0.7) 35%, hsl(0 0% 0% / 0.95) 100%)",
        }}
      >
        {/* Tier */}
        <ControlRow label="Tier" value={`${tier} / 5`}>
          <Slider
            value={[tier]}
            min={0}
            max={5}
            step={1}
            onValueChange={(v) => setTier(v[0])}
          />
        </ControlRow>

        {/* Size */}
        <ControlRow label="Koko" value={`${size}px`}>
          <Slider
            value={[size]}
            min={120}
            max={420}
            step={4}
            onValueChange={(v) => setSize(v[0])}
          />
        </ControlRow>

        {/* Accent presets */}
        <div>
          <p className="text-[10px] font-black tracking-widest uppercase text-muted-foreground mb-2">
            Accent
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {ACCENT_PRESETS.map((p) => {
              const active = p.value === accent;
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setAccent(p.value)}
                  className={cn(
                    "shrink-0 flex flex-col items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-colors",
                    active
                      ? "border-foreground/80 bg-foreground/5"
                      : "border-border/50 hover:border-border",
                  )}
                >
                  <span
                    className="block h-5 w-5 rounded-full ring-1 ring-black/40"
                    style={{
                      background: p.value,
                      boxShadow: `0 0 10px ${p.value.replace(")", " / 0.7)")}`,
                    }}
                  />
                  <span className="text-[9px] font-black uppercase tracking-wider">
                    {p.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <p className="text-[9px] text-muted-foreground/60 text-center leading-snug">
          Tarkemmat asetukset oikean alakulman <span className="text-[hsl(18_95%_58%)] font-bold">Flame Dev</span> -paneelista.
        </p>
      </div>

      {/* Always-on dev panel for deep tuning */}
      <FlameDevPanel />
    </div>
  );
};

const ControlRow = ({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: React.ReactNode;
}) => (
  <div>
    <div className="flex items-center justify-between mb-1.5">
      <p className="text-[10px] font-black tracking-widest uppercase text-muted-foreground">
        {label}
      </p>
      <span className="text-[10px] font-black tabular-nums text-foreground/90">
        {value}
      </span>
    </div>
    {children}
  </div>
);

export default Index;
