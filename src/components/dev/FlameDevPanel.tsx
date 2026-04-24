/**
 * FlameDevPanel — floating developer controls for the bonfire flame.
 *
 * Auto-shows on dev/preview hosts. Dismiss via the X button (persists), or use
 * `?devflame=1` / `?devflame=0` to force-toggle visibility.
 *
 * Controls: contrast preset (Normal / High-Contrast / Razor Sharp), layer
 * density, opacity multiplier, dense-core boost, edge clipping (kills halo
 * fringe), and an auto-degrade toggle that watches FPS in real time.
 */
import { useEffect, useState } from "react";
import { X, Flame, RotateCcw, Activity } from "lucide-react";
import {
  DEFAULT_FLAME_SETTINGS,
  type FlameContrastMode,
  classifyPerf,
  isFlameDevPanelEnabled,
  readFlameSettings,
  useFps,
  writeFlameSettings,
} from "@/lib/flame-dev-settings";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FlameDevPanel = () => {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(true);
  const [settings, setSettings] = useState(() => readFlameSettings());
  const fps = useFps();
  const tier = classifyPerf(fps);

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

  // Color the FPS chip green/amber/red based on perf tier.
  const fpsColor =
    tier === "smooth"
      ? "hsl(140 80% 55%)"
      : tier === "ok"
      ? "hsl(38 95% 60%)"
      : "hsl(0 85% 62%)";

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
        <div className="flex items-center gap-1.5">
          {/* Live FPS chip */}
          <span
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-black tabular-nums border"
            style={{
              color: fpsColor,
              borderColor: `${fpsColor.replace(")", " / 0.45)")}`,
              background: `${fpsColor.replace(")", " / 0.12)")}`,
            }}
            title={`${fps} FPS — ${tier}`}
          >
            <Activity className="h-3 w-3" />
            {fps}
          </span>
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
        <div className="px-3 py-3 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Contrast mode — 3 presets in a row */}
          <div>
            <p className="text-[10px] font-black tracking-widest uppercase text-muted-foreground mb-1.5">
              Sharpening Mode
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {(["normal", "high-contrast", "razor-sharp"] as FlameContrastMode[]).map(
                (mode) => {
                  const active = settings.contrastMode === mode;
                  const label =
                    mode === "normal"
                      ? "Normal"
                      : mode === "high-contrast"
                      ? "High"
                      : "Razor";
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => update({ contrastMode: mode })}
                      className={cn(
                        "px-2 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-colors",
                        active
                          ? mode === "razor-sharp"
                            ? "bg-[hsl(0_85%_55%)] text-white border-transparent"
                            : "bg-[hsl(18_95%_58%)] text-white border-transparent"
                          : "bg-secondary/40 border-border/60 text-foreground/80 hover:bg-secondary/70",
                      )}
                    >
                      {label}
                    </button>
                  );
                },
              )}
            </div>
            <p className="mt-1 text-[9px] text-muted-foreground/70 leading-snug">
              {settings.contrastMode === "razor-sharp"
                ? "Maximum contrast + saturation, blur stripped from overlays."
                : settings.contrastMode === "high-contrast"
                ? "Boosted contrast, stronger drop-shadows."
                : "Default soft balance."}
            </p>
          </div>

          {/* Edge clipping */}
          <div className="rounded-xl border border-border/60 bg-secondary/30 p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black tracking-widest uppercase">
                  Edge Clipping
                </p>
                <p className="text-[9px] text-muted-foreground/70 leading-snug">
                  Mask sharpening to flame interior — kills halo fringe.
                </p>
              </div>
              <Switch
                checked={settings.edgeClipping}
                onCheckedChange={(v) => update({ edgeClipping: v })}
              />
            </div>
            {settings.edgeClipping && (
              <SliderRow
                label="Edge Softness"
                value={settings.edgeSoftness}
                min={0}
                max={1}
                step={0.05}
                display={`${Math.round(settings.edgeSoftness * 100)}%`}
                onChange={(v) => update({ edgeSoftness: v })}
              />
            )}
          </div>

          {/* Auto-degrade */}
          <div className="rounded-xl border border-border/60 bg-secondary/30 p-2.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black tracking-widest uppercase">
                  Auto-Degrade
                </p>
                <p className="text-[9px] text-muted-foreground/70 leading-snug">
                  Drops layers + softens filters when FPS &lt; 35 for 1.5s.
                </p>
              </div>
              <Switch
                checked={settings.autoDegrade}
                onCheckedChange={(v) => update({ autoDegrade: v })}
              />
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
