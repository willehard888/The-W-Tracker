import { useState } from "react";
import { Eye, EyeOff, Copy, Trash2, Plus, ArrowUp, ArrowDown, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type FlameBlendMode,
  type FlameLayer,
  useCustomFlameLayers,
} from "@/lib/custom-flame";

/**
 * Flame Builder — käyttäjän oma liekki kerros kerrokselta.
 *
 * Vasen/yläpaneeli: live-esikatselu mustalla.
 * Oikea/alapaneeli: kerroslista + valitun kerroksen täydet säätimet.
 * Kaikki tila tallentuu localStorage:iin reaaliaikaisesti.
 */

const BLEND_MODES: FlameBlendMode[] = [
  "screen",
  "lighten",
  "color-dodge",
  "plus-lighter",
  "overlay",
  "normal",
];

const Index = () => {
  const {
    layers,
    updateLayer,
    addLayer,
    removeLayer,
    duplicateLayer,
    moveLayer,
    reset,
  } = useCustomFlameLayers();
  const [selectedId, setSelectedId] = useState<string | null>(layers[0]?.id ?? null);
  const selected = layers.find((l) => l.id === selectedId) ?? layers[0] ?? null;

  return (
    <div className="h-full w-full flex flex-col bg-black text-foreground overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-3 flex items-center justify-between border-b border-border/40">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[hsl(18_95%_58%)]">
            Flame Builder
          </p>
          <p className="text-[10px] text-muted-foreground/70 mt-0.5">
            Rakenna oma liekki kerros kerrokselta
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={reset}
          className="h-7 px-3 text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-[hsl(322_90%_55%)] via-[hsl(20_95%_56%)] to-[hsl(48_100%_64%)] text-white border-0 shadow-[0_0_14px_hsl(20_95%_56%/0.6)] hover:opacity-90"
        >
          <RotateCcw className="h-3 w-3 mr-1" />
          Cinematic Inferno
        </Button>
      </div>

      {/* Stage */}
      <div
        className="shrink-0 relative"
        style={{
          height: "38vh",
          minHeight: 240,
          background:
            "radial-gradient(ellipse 80% 60% at 50% 60%, hsl(0 0% 6%) 0%, hsl(0 0% 1.5%) 70%, #000 100%)",
        }}
      >
        <div className="absolute inset-0 flex items-end justify-center pb-6">
          <FlameStage layers={layers} />
        </div>
        <span className="absolute top-2 right-3 text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">
          {layers.filter((l) => l.visible).length} / {layers.length} layers
        </span>
      </div>

      {/* Layer list + editor */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {/* Layer list */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Kerrokset (taakse → eteen)
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={addLayer}
              className="h-7 px-2 text-[10px] font-black uppercase tracking-wider"
            >
              <Plus className="h-3 w-3 mr-1" />
              Lisää
            </Button>
          </div>
          <div className="space-y-1.5">
            {layers.map((layer, idx) => {
              const isSelected = layer.id === selectedId;
              return (
                <div
                  key={layer.id}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors",
                    isSelected
                      ? "border-[hsl(18_95%_58%)] bg-[hsl(18_95%_58%/0.08)]"
                      : "border-border/50 hover:border-border bg-secondary/20",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(layer.id)}
                    className="flex-1 flex items-center gap-2 text-left min-w-0"
                  >
                    <span
                      className="block h-5 w-5 rounded-md ring-1 ring-black/40 shrink-0"
                      style={{
                        background: layer.color,
                        boxShadow: `0 0 8px ${layer.color.replace(")", " / 0.6)")}`,
                        opacity: layer.visible ? 1 : 0.3,
                      }}
                    />
                    <span className="truncate text-xs font-bold">{layer.name}</span>
                    <span className="text-[9px] text-muted-foreground/60 tabular-nums shrink-0">
                      #{idx + 1}
                    </span>
                  </button>
                  <div className="flex items-center gap-0.5">
                    <IconBtn
                      title="Visibility"
                      onClick={() => updateLayer(layer.id, { visible: !layer.visible })}
                    >
                      {layer.visible ? (
                        <Eye className="h-3 w-3" />
                      ) : (
                        <EyeOff className="h-3 w-3 opacity-50" />
                      )}
                    </IconBtn>
                    <IconBtn
                      title="Move back"
                      disabled={idx === 0}
                      onClick={() => moveLayer(layer.id, -1)}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </IconBtn>
                    <IconBtn
                      title="Move front"
                      disabled={idx === layers.length - 1}
                      onClick={() => moveLayer(layer.id, 1)}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </IconBtn>
                    <IconBtn title="Duplicate" onClick={() => duplicateLayer(layer.id)}>
                      <Copy className="h-3 w-3" />
                    </IconBtn>
                    <IconBtn
                      title="Delete"
                      disabled={layers.length <= 1}
                      onClick={() => {
                        if (layer.id === selectedId) {
                          const next = layers.filter((l) => l.id !== layer.id);
                          setSelectedId(next[0]?.id ?? null);
                        }
                        removeLayer(layer.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3 text-[hsl(0_75%_60%)]" />
                    </IconBtn>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Editor for selected */}
        {selected && (
          <div className="rounded-xl border border-border/50 bg-secondary/20 p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Input
                value={selected.name}
                onChange={(e) => updateLayer(selected.id, { name: e.target.value })}
                className="h-7 text-xs font-bold bg-background/50"
              />
            </div>

            {/* Color */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">
                Väri (HSL)
              </p>
              <div className="flex items-center gap-2">
                <span
                  className="block h-9 w-9 rounded-md ring-1 ring-black/40 shrink-0"
                  style={{
                    background: selected.color,
                    boxShadow: `0 0 12px ${selected.color.replace(")", " / 0.7)")}`,
                  }}
                />
                <Input
                  value={selected.color}
                  onChange={(e) => updateLayer(selected.id, { color: e.target.value })}
                  className="h-9 text-xs font-mono bg-background/50"
                  placeholder="hsl(28 95% 58%)"
                />
              </div>
              <HuePicker
                value={selected.color}
                onChange={(c) => updateLayer(selected.id, { color: c })}
              />
            </div>

            <Row label="Leveys" value={`${selected.width}px`}>
              <Slider
                value={[selected.width]}
                min={20}
                max={400}
                step={2}
                onValueChange={(v) => updateLayer(selected.id, { width: v[0] })}
              />
            </Row>
            <Row label="Korkeus" value={`${selected.height}px`}>
              <Slider
                value={[selected.height]}
                min={20}
                max={500}
                step={2}
                onValueChange={(v) => updateLayer(selected.id, { height: v[0] })}
              />
            </Row>
            <Row label="Y-poikkeama" value={`${selected.offsetY}px`}>
              <Slider
                value={[selected.offsetY]}
                min={-120}
                max={120}
                step={1}
                onValueChange={(v) => updateLayer(selected.id, { offsetY: v[0] })}
              />
            </Row>
            <Row label="X-poikkeama" value={`${selected.offsetX}px`}>
              <Slider
                value={[selected.offsetX]}
                min={-120}
                max={120}
                step={1}
                onValueChange={(v) => updateLayer(selected.id, { offsetX: v[0] })}
              />
            </Row>
            <Row label="Opacity" value={`${Math.round(selected.opacity * 100)}%`}>
              <Slider
                value={[selected.opacity]}
                min={0}
                max={1}
                step={0.02}
                onValueChange={(v) => updateLayer(selected.id, { opacity: v[0] })}
              />
            </Row>
            <Row label="Blur" value={`${selected.blur}px`}>
              <Slider
                value={[selected.blur]}
                min={0}
                max={60}
                step={1}
                onValueChange={(v) => updateLayer(selected.id, { blur: v[0] })}
              />
            </Row>

            {/* Blend */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">
                Blend mode
              </p>
              <div className="grid grid-cols-3 gap-1">
                {BLEND_MODES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => updateLayer(selected.id, { blend: m })}
                    className={cn(
                      "px-2 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-colors",
                      selected.blend === m
                        ? "bg-[hsl(18_95%_58%)] text-white border-transparent"
                        : "bg-secondary/40 border-border/60 text-foreground/80 hover:bg-secondary/70",
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <Row
              label="Flicker speed"
              value={selected.flickerSpeed === 0 ? "off" : `${selected.flickerSpeed.toFixed(2)}s`}
            >
              <Slider
                value={[selected.flickerSpeed]}
                min={0}
                max={4}
                step={0.05}
                onValueChange={(v) => updateLayer(selected.id, { flickerSpeed: v[0] })}
              />
            </Row>
            <Row label="Flicker amount" value={`${Math.round(selected.flickerAmount * 100)}%`}>
              <Slider
                value={[selected.flickerAmount]}
                min={0}
                max={1}
                step={0.05}
                onValueChange={(v) => updateLayer(selected.id, { flickerAmount: v[0] })}
              />
            </Row>
          </div>
        )}

        <p className="text-[9px] text-muted-foreground/50 text-center pt-2">
          Tallentuu automaattisesti tähän selaimeen.
        </p>
      </div>
    </div>
  );
};

/* ─── Preview stage ───────────────────────────────────────────────────── */
const FlameStage = ({ layers }: { layers: FlameLayer[] }) => (
  <div className="relative" style={{ width: 320, height: 320, isolation: "isolate" }}>
    {layers.map((layer, i) => {
      if (!layer.visible) return null;
      const flickerScaleMax = 1 + layer.flickerAmount * 0.12;
      const flickerScaleMin = 1 - layer.flickerAmount * 0.06;
      const flickerOpacityMin = Math.max(0.3, layer.opacity * (1 - layer.flickerAmount * 0.35));
      const animation =
        layer.flickerSpeed > 0
          ? `custom-flame-flicker ${layer.flickerSpeed}s ease-in-out infinite`
          : "none";
      return (
        <div
          key={layer.id}
          className="absolute pointer-events-none rounded-full"
          style={{
            left: "50%",
            bottom: 0,
            width: layer.width,
            height: layer.height,
            opacity: layer.opacity,
            filter: layer.blur > 0 ? `blur(${layer.blur}px)` : undefined,
            mixBlendMode: layer.blend,
            zIndex: i,
            background: `radial-gradient(ellipse at 50% 80%, ${layer.color} 0%, ${layer.color.replace(
              ")",
              " / 0.6)",
            )} 35%, ${layer.color.replace(")", " / 0)")} 70%)`,
            // Center horizontally + apply offsets via transform via CSS vars,
            // so the flicker keyframe can layer its own translate cleanly.
            transform: `translate(calc(-50% + ${layer.offsetX}px), ${-layer.offsetY}px)`,
            // CSS vars consumed by @keyframes custom-flame-flicker
            ["--cf-x" as string]: "0px",
            ["--cf-y" as string]: "0px",
            ["--cf-scale-min" as string]: flickerScaleMin.toString(),
            ["--cf-scale-mid" as string]: "1",
            ["--cf-scale-max" as string]: flickerScaleMax.toString(),
            ["--cf-opacity-min" as string]: flickerOpacityMin.toString(),
            ["--cf-opacity-mid" as string]: layer.opacity.toString(),
            ["--cf-opacity-max" as string]: "1",
            transformOrigin: "50% 100%",
            // Wrap the actual flicker on a child via animation here — we'd lose
            // the centering transform. Instead apply a second translate via
            // animation that *adds* to the existing one through CSS vars.
            animation,
          }}
        />
      );
    })}
  </div>
);

/* ─── small helpers ───────────────────────────────────────────────────── */
const Row = ({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: React.ReactNode;
}) => (
  <div>
    <div className="flex items-center justify-between mb-1">
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <span className="text-[10px] font-black tabular-nums text-foreground/90">{value}</span>
    </div>
    {children}
  </div>
);

const IconBtn = ({
  children,
  onClick,
  title,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  disabled?: boolean;
}) => (
  <button
    type="button"
    title={title}
    onClick={onClick}
    disabled={disabled}
    className="h-6 w-6 rounded-md inline-flex items-center justify-center text-foreground/80 hover:bg-foreground/10 disabled:opacity-30 disabled:pointer-events-none"
  >
    {children}
  </button>
);

/** Quick HSL hue strip — drags through the rainbow at fixed S/L. */
const HuePicker = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) => {
  // Parse "hsl(H S% L%)" — fall back to 28/95/58 defaults if it doesn't match.
  const m = value.match(/hsl\(\s*(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%/);
  const h = m ? Number(m[1]) : 28;
  const s = m ? Number(m[2]) : 95;
  const l = m ? Number(m[3]) : 58;

  const setH = (next: number) => onChange(`hsl(${Math.round(next)} ${s}% ${l}%)`);
  const setS = (next: number) => onChange(`hsl(${h} ${Math.round(next)}% ${l}%)`);
  const setL = (next: number) => onChange(`hsl(${h} ${s}% ${Math.round(next)}%)`);

  return (
    <div className="mt-2 space-y-2">
      <HslStrip
        label={`H ${Math.round(h)}°`}
        value={h}
        max={360}
        gradient="linear-gradient(to right, hsl(0 95% 58%), hsl(60 95% 58%), hsl(120 95% 58%), hsl(180 95% 58%), hsl(240 95% 58%), hsl(300 95% 58%), hsl(360 95% 58%))"
        onChange={setH}
      />
      <HslStrip
        label={`S ${Math.round(s)}%`}
        value={s}
        max={100}
        gradient={`linear-gradient(to right, hsl(${h} 0% ${l}%), hsl(${h} 100% ${l}%))`}
        onChange={setS}
      />
      <HslStrip
        label={`L ${Math.round(l)}%`}
        value={l}
        max={100}
        gradient={`linear-gradient(to right, hsl(${h} ${s}% 0%), hsl(${h} ${s}% 50%), hsl(${h} ${s}% 100%))`}
        onChange={setL}
      />
    </div>
  );
};

const HslStrip = ({
  label,
  value,
  max,
  gradient,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  gradient: string;
  onChange: (v: number) => void;
}) => (
  <div>
    <div className="flex items-center justify-between mb-0.5">
      <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/80">
        {label}
      </p>
    </div>
    <div className="relative h-6 rounded-md overflow-hidden ring-1 ring-border/60" style={{ background: gradient }}>
      <input
        type="range"
        min={0}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
      <span
        aria-hidden
        className="absolute top-0 bottom-0 w-1 bg-white/90 rounded-full pointer-events-none shadow-[0_0_4px_rgba(0,0,0,0.6)]"
        style={{ left: `calc(${(value / max) * 100}% - 2px)` }}
      />
    </div>
  </div>
);

export default Index;
