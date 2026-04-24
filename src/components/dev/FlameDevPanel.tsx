/**
 * FlameDevPanel — floating developer controls for the bonfire flame.
 *
 * Visibility: only mounts when `?devflame=1` is set in the URL or
 * `localStorage.flameDevPanel === "1"`. Append `?devflame=0` to dismiss.
 *
 * Adjusts layer density, opacity multiplier, dense-core boost, and switches
 * between Normal / High-Contrast modes — all without code changes.
 */
import { useEffect, useState } from "react";
import { X, Flame, RotateCcw } from "lucide-react";
import {
  DEFAULT_FLAME_SETTINGS,
  type FlameContrastMode,
  isFlameDevPanelEnabled,
  readFlameSettings,
  writeFlameSettings,
} from "@/lib/flame-dev-settings";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FlameDevPanel = () => {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(true);
  const [settings, setSettings] = useState(() => readFlameSettings());

  useEffect(() => {
    setEnabled(isFlameDevPanelEnabled());
  }, []);

  if (!enabled) return null;

  const update = (patch: Partial<typeof settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    writeFlameSettings(next);
  };

  const reset = () => {
    setSettings(DEFAULT_FLAME_SETTINGS);
    writeFlameSettings(DEFAULT_FLAME_SETTINGS);
  };

  const dismiss = () => {
    try {
      localStorage.setItem("flameDevPanel", "0");
    } catch {
      /* noop */
    }
    setEnabled(false);
  };

  return (
    <div
      className={cn(
        "fixed z-[9999] bottom-4 right-4 w-[300px] max-w-[calc(100vw-2rem)]",
        "rounded-2xl border border-border/80 bg-background/95 backdrop-blur-xl shadow-2xl",
        "text-foreground",
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/60">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-xs font-black tracking-widest uppercase text-foreground/90"
        >
          <Flame className="h-3.5 w-3.5 text-[hsl(18_95%_58%)]" />
          Flame Dev
          <span className="text-muted-foreground/70 font-bold normal-case tracking-normal">
            {open ? "▾" : "▸"}
          </span>
        </button>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={reset}
            title="Reset to defaults"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={dismiss}
            title="Hide panel (use ?devflame=1 to re-open)"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {open && (
        <div className="px-3 py-3 space-y-4">
          {/* Contrast mode */}
          <div>
            <p className="text-[10px] font-black tracking-widest uppercase text-muted-foreground mb-1.5">
              Contrast Mode
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {(["normal", "high-contrast"] as FlameContrastMode[]).map((mode) => {
                const active = settings.contrastMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => update({ contrastMode: mode })}
                    className={cn(
                      "px-2 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider border transition-colors",
                      active
                        ? "bg-[hsl(18_95%_58%)] text-white border-transparent"
                        : "bg-secondary/40 border-border/60 text-foreground/80 hover:bg-secondary/70",
                    )}
                  >
                    {mode === "normal" ? "Normal" : "High-Contrast"}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Layer density */}
          <SliderRow
            label="Layer Density"
            value={settings.layerDensity}
            min={0.3}
            max={1}
            step={0.05}
            display={`${Math.round(settings.layerDensity * 100)}%`}
            onChange={(v) => update({ layerDensity: v })}
          />

          {/* Opacity multiplier */}
          <SliderRow
            label="Opacity Multiplier"
            value={settings.opacityMultiplier}
            min={0.4}
            max={1.4}
            step={0.05}
            display={settings.opacityMultiplier.toFixed(2) + "×"}
            onChange={(v) => update({ opacityMultiplier: v })}
          />

          {/* Dense core */}
          <SliderRow
            label="Dense Core"
            value={settings.denseCore}
            min={0}
            max={1}
            step={0.05}
            display={`${Math.round(settings.denseCore * 100)}%`}
            onChange={(v) => update({ denseCore: v })}
          />

          <p className="text-[10px] text-muted-foreground/70 pt-1 border-t border-border/40 leading-snug">
            URL <code className="font-mono">?devflame=0</code> hides this panel.
          </p>
        </div>
      )}
    </div>
  );
};

const SliderRow = ({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) => (
  <div>
    <div className="flex items-center justify-between mb-1.5">
      <p className="text-[10px] font-black tracking-widest uppercase text-muted-foreground">
        {label}
      </p>
      <span className="text-[10px] font-black tabular-nums text-foreground/90">
        {display}
      </span>
    </div>
    <Slider
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={(v) => onChange(v[0])}
    />
  </div>
);

export default FlameDevPanel;
