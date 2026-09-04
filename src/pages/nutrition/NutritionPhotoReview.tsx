import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Camera, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import EmptyState from "@/components/ui/empty-state";
import { Switch } from "@/components/ui/switch";
import { SEGMENT_ACTIVE, SEGMENT_IDLE, SEGMENT_TRACK } from "@/components/ui/segment";
import { cn } from "@/lib/utils";
import { hapticSelection } from "@/lib/haptics";
import { track } from "@/lib/analytics";
import { downscaleImage } from "@/lib/downscale-image";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import NutritionPageBar from "@/components/nutrition/NutritionPageBar";
import DetectedItemRow from "@/components/nutrition/DetectedItemRow";
import NutrientPreview from "@/components/nutrition/NutrientPreview";
import FoodPickerSheet from "@/components/nutrition/FoodPickerSheet";
import { localDateKey } from "@/components/nutrition/DateBar";
import { useLogMeal } from "@/hooks/use-log-meal";
import { useNutritionScan, type ScanFailureReason } from "@/hooks/use-nutrition-scan";
import { takePendingPhoto } from "@/lib/nutrition/pending-photo";
import { fetchFood } from "@/lib/nutrition/queries";
import { scale } from "@/lib/nutrition/scale";
import { confidenceTier, type ScanCandidate, type ScanItem, type ScanMacroPreview } from "@/lib/nutrition/scan-types";
import { MEAL_SLOTS, defaultSlotForHour } from "@/lib/nutrition/slots";
import type { Food, MealSlot, NutrientVector } from "@/lib/nutrition/types";

const isSlot = (v: string | null): v is MealSlot => MEAL_SLOTS.some((s) => s.key === v);
const lang = typeof navigator !== "undefined" ? navigator.language : "en";
const SCAN_OPTS = { locale: lang.toLowerCase().startsWith("fi") ? ("fi" as const) : ("en" as const), country: lang.split("-")[1]?.toUpperCase() };

/** Scale a candidate's per-100 g figures exactly like the server would (absent stays absent). */
const previewFor = (c: ScanCandidate | undefined, grams: number): ScanMacroPreview | null => {
  if (!c) return null;
  const v: NutrientVector = {};
  if (c.per_100g.kcal != null) v.kcal = c.per_100g.kcal;
  if (c.per_100g.protein_g != null) v.protein_g = c.per_100g.protein_g;
  if (c.per_100g.carbs_g != null) v.carbs_g = c.per_100g.carbs_g;
  if (c.per_100g.fat_g != null) v.fat_g = c.per_100g.fat_g;
  const s = scale(v, grams);
  return { kcal: s.kcal ?? null, protein_g: s.protein_g ?? null, carbs_g: s.carbs_g ?? null, fat_g: s.fat_g ?? null };
};
const candidateOf = (food: Food): ScanCandidate => ({
  food_id: food.id,
  name: food.name,
  brand: food.brand ?? null,
  similarity: 1,
  per_100g: { kcal: food.per100g.kcal ?? null, protein_g: food.per100g.protein_g ?? null, carbs_g: food.per100g.carbs_g ?? null, fat_g: food.per100g.fat_g ?? null },
});
const chosenOf = (i: ScanItem) => i.candidates.find((c) => c.food_id === i.selected_food_id);

const FAILURE_COPY: Record<ScanFailureReason, { title: string; body: string }> = {
  offline: { title: "Photo scan needs a connection", body: "Nothing was added. Log it by search now and the photo can wait." },
  membership_required: { title: "Photo scan is part of membership", body: "Your diary still works — search or scan a barcode instead." },
  scan_limit: { title: "Daily scan limit reached", body: "Log manually for now; scans reset tomorrow." },
  bad_image: { title: "That photo can't be read", body: "Try a clearer, closer shot of the plate." },
  timeout: { title: "Couldn't read this meal.", body: "Nothing was added." },
  invalid_response: { title: "Couldn't read this meal.", body: "Nothing was added." },
  failed: { title: "Couldn't read this meal.", body: "Nothing was added." },
};

/**
 * A guess you confirm. The camera never writes to the diary: the model
 * names foods and estimates portions, the database supplies nutrition, and
 * nothing is saved until every item has a chosen record and the user says
 * "Add to diary". The photo itself is discarded unless the user keeps it.
 */
const NutritionPhotoReview = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const { status, result, failure, scan, cancel, reset } = useNutritionScan();
  const { logMeal } = useLogMeal();

  const date = params.get("date") ?? localDateKey();
  const [file, setFile] = useState<File | null>(() => takePendingPhoto());
  const [preview, setPreview] = useState<string | null>(null);
  const [hint, setHint] = useState("");
  const [items, setItems] = useState<ScanItem[]>([]);
  const [slot, setSlot] = useState<MealSlot>(() => {
    const p = params.get("slot");
    return isSlot(p) ? p : defaultSlotForHour(new Date().getHours(), new Date().getMinutes());
  });
  const [keepPhoto, setKeepPhoto] = useState(false);
  const [picker, setPicker] = useState<{ itemId: string | null } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const stats = useRef({ removed: 0, recandidated: 0, edited: new Set<string>(), scanned: 0 });

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!result) return;
    setItems(result.items);
    stats.current = { removed: 0, recandidated: 0, edited: new Set(), scanned: result.items.length };
  }, [result]);

  const start = (f: File) => void scan(f, { ...SCAN_OPTS, hint: hint.trim() || undefined });
  const manual = () => navigate(`/nutrition?date=${date}&slot=${slot}&add=1`);
  const pickFile = (f: File | null) => {
    if (!f) return;
    reset();
    setItems([]);
    setFile(f);
  };
  const leave = () => {
    cancel();
    navigate(-1);
  };

  const patch = (id: string, fn: (i: ScanItem) => ScanItem) => setItems((rows) => rows.map((r) => (r.id === id ? fn(r) : r)));
  const onGramsChange = (id: string, grams: number) => {
    stats.current.edited.add(id);
    patch(id, (i) => ({ ...i, grams, preview: previewFor(chosenOf(i), grams) }));
  };
  const onPickCandidate = (id: string, foodId: string) => {
    stats.current.recandidated += 1;
    patch(id, (i) => ({ ...i, selected_food_id: foodId, needs_user_choice: false, preview: previewFor(i.candidates.find((c) => c.food_id === foodId), i.grams) }));
  };
  const onRemove = (id: string) => {
    stats.current.removed += 1;
    setItems((rows) => rows.filter((r) => r.id !== id));
  };
  const onPicked = async (foodId: string, fallbackName: string) => {
    const target = picker;
    setPicker(null);
    const food = await fetchFood(supabase, foodId).catch(() => null);
    if (!food) {
      toast.error(`Couldn't load ${fallbackName}`);
      return;
    }
    const cand = candidateOf(food);
    if (target?.itemId) {
      stats.current.recandidated += 1;
      patch(target.itemId, (i) => ({ ...i, candidates: [cand], selected_food_id: cand.food_id, needs_user_choice: false, preview: previewFor(cand, i.grams) }));
      return;
    }
    const grams = food.servings.find((s) => s.id === food.defaultServingId)?.grams ?? 100;
    setItems((rows) => [
      ...rows,
      {
        id: crypto.randomUUID(),
        name: food.name,
        category: "other",
        preparation: "unknown",
        grams,
        grams_low: grams,
        grams_high: grams,
        count: null,
        is_liquid: false,
        identification_confidence: 1,
        portion_confidence: 1,
        needs_user_choice: false,
        selected_food_id: cand.food_id,
        candidates: [cand],
        preview: previewFor(cand, grams),
      },
    ]);
  };

  const totals = items.reduce(
    (t, i) => ({
      calories: t.calories + (i.preview?.kcal ?? 0),
      protein: t.protein + (i.preview?.protein_g ?? 0),
      carbs: t.carbs + (i.preview?.carbs_g ?? 0),
      fat: t.fat + (i.preview?.fat_g ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
  const unresolved = items.filter((i) => !i.selected_food_id).length;
  const estimates = items.filter((i) => confidenceTier(i) !== "solid").length;
  const canSave = items.length > 0 && unresolved === 0 && !saving;

  const uploadPhoto = async (): Promise<string | null> => {
    if (!file || !user?.id) return null;
    try {
      const shrunk = await downscaleImage(file);
      const path = `${user.id}/${Date.now()}.jpg`;
      const { error } = await supabase.storage.from("meal-photos").upload(path, shrunk, { contentType: "image/jpeg" });
      if (error) throw error;
      return path;
    } catch {
      toast("Photo not saved", { description: "The meal is still being added." });
      return null;
    }
  };
  const commit = async () => {
    if (!canSave || !result) return;
    setSaving(true);
    const s = stats.current;
    const telemetry = {
      items: items.length,
      items_removed: s.removed,
      items_recandidated: s.recandidated,
      grams_edited_pct: s.scanned > 0 ? Math.round((100 * s.edited.size) / s.scanned) : 0,
      overall_confidence: result.overall_confidence,
    };
    try {
      const photoPath = keepPhoto ? await uploadPhoto() : null;
      await logMeal({
        date,
        slot,
        source: "scan",
        photoPath,
        items: items.map((i) => {
          const c = chosenOf(i);
          const snap: NutrientVector = {};
          if (i.preview?.kcal != null) snap.kcal = i.preview.kcal;
          if (i.preview?.protein_g != null) snap.protein_g = i.preview.protein_g;
          if (i.preview?.carbs_g != null) snap.carbs_g = i.preview.carbs_g;
          if (i.preview?.fat_g != null) snap.fat_g = i.preview.fat_g;
          return { kind: "food" as const, food_id: i.selected_food_id as string, grams: i.grams, name: c?.name ?? i.name, snapshot: snap };
        }),
      });
      void track("nutrition_scan_reviewed", { ...telemetry, saved: true });
      toast.success("Meal added");
      navigate(`/nutrition?date=${date}`, { replace: true });
    } catch {
      void track("nutrition_scan_reviewed", { ...telemetry, saved: false });
      setSaving(false);
    }
  };
  const save = () => (result?.low_confidence && estimates > 0 ? setConfirmOpen(true) : void commit());

  const fileInput = (label: string, variant: "default" | "outline" = "default") => (
    <label className="block">
      <span className="sr-only">{label}</span>
      {/* No capture attribute here: this picker is the library path (Take Photo / Photo Library on iOS); Home's camera button is the quick-snap path. */}
      <input type="file" accept="image/*" className="sr-only" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
      <Button asChild variant={variant} size="lg" className="w-full">
        <span>
          <Camera aria-hidden /> {label}
        </span>
      </Button>
    </label>
  );
  const photo = (overlay?: ReactNode) => (
    <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/40 aspect-[4/3]">
      {preview && <img src={preview} alt="" className="absolute inset-0 h-full w-full object-cover" />}
      {overlay}
    </div>
  );

  let body: ReactNode;
  if (!file) {
    body = (
      <div className="animate-reveal pt-6">
        <EmptyState icon={Camera} title="Scan a meal" description="Point at the plate. You confirm every item before anything is saved." action={fileInput("Take or choose a photo")} />
        <Button variant="ghost" className="w-full mt-3 min-h-11" onClick={manual}>
          Log manually instead
        </Button>
      </div>
    );
  } else if (status === "preparing" || status === "analyzing") {
    body = (
      <div className="animate-reveal space-y-4">
        {photo(
          <div
            aria-hidden
            className="absolute inset-0 -translate-x-full animate-[skeleton-sweep_1.6s_ease-in-out_infinite]"
            style={{ background: "linear-gradient(90deg, transparent 0%, hsl(var(--gold) / 0.10) 45%, hsl(var(--gold) / 0.22) 50%, hsl(var(--gold) / 0.10) 55%, transparent 100%)" }}
          />,
        )}
        <div role="status" aria-live="polite">
          <p className="font-display font-black text-[22px] leading-tight tracking-tight">Looking at your plate…</p>
          <p className="text-[13px] text-muted-foreground mt-1">Nothing is saved until you confirm.</p>
        </div>
        <Button variant="outline" size="lg" className="w-full" onClick={leave}>
          Cancel
        </Button>
      </div>
    );
  } else if (status === "error" && failure) {
    const copy = FAILURE_COPY[failure.reason];
    body = (
      <div className="animate-reveal space-y-4">
        {photo(<div className="absolute inset-0 bg-background/55" aria-hidden />)}
        <div role="alert">
          <p className="font-display font-black text-[22px] leading-tight tracking-tight">{copy.title}</p>
          <p className="text-[13px] text-muted-foreground mt-1">{copy.body}</p>
        </div>
        {failure.retryable && (
          <input
            type="text"
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            placeholder="What is it? e.g. lohta ja perunaa"
            aria-label="Hint for the scanner"
            className="w-full surface-inset rounded-xl h-11 px-3 text-[15px] outline-none focus:border-gold/50"
          />
        )}
        <div className="space-y-2">
          {failure.retryable && (
            <Button size="lg" className="w-full" onClick={() => start(file)}>
              Try again
            </Button>
          )}
          {failure.reason === "bad_image" && fileInput("Choose another photo", "outline")}
          <Button variant={failure.retryable ? "outline" : "default"} size="lg" className="w-full" onClick={manual}>
            Log manually
          </Button>
        </div>
      </div>
    );
  } else if (status === "done" && result?.not_food) {
    body = (
      <div className="animate-reveal space-y-4">
        {photo(<div className="absolute inset-0 bg-background/55" aria-hidden />)}
        <div role="status">
          <p className="font-display font-black text-[22px] leading-tight tracking-tight">No food found in this photo.</p>
          <p className="text-[13px] text-muted-foreground mt-1">Nothing was invented.</p>
        </div>
        <div className="space-y-2">
          {fileInput("Try another photo")}
          <Button variant="outline" size="lg" className="w-full" onClick={manual}>
            Log manually
          </Button>
        </div>
      </div>
    );
  } else if (status === "done" && result) {
    const pct = Math.round(result.overall_confidence * 100);
    body = (
      <div className="space-y-6">
        <div className="animate-reveal">
          {photo(
            <span className="absolute left-3 bottom-3 inline-flex items-center rounded-full border border-border/60 bg-background/80 backdrop-blur-sm px-2.5 py-1 text-[11px] font-black uppercase tracking-wider tabular-nums">
              Estimated · {pct} % confident
            </span>,
          )}
          <h2 className="font-display font-black text-[27px] leading-[1.04] tracking-tight mt-4">
            {items.length === 0 ? "Nothing left to add." : unresolved > 0 ? `${unresolved} ${unresolved === 1 ? "item needs" : "items need"} a match.` : `${items.length} ${items.length === 1 ? "item" : "items"}, ready when you are.`}
          </h2>
          {result.low_confidence && (
            <p role="status" className="mt-2 text-[13px] leading-snug text-[hsl(var(--ember))]">
              Some of this is a guess. Check the marked items before adding.
            </p>
          )}
        </div>

        <div className="animate-reveal animate-reveal-delay-1">
          <div className="divide-y divide-border/35">
            {items.map((i) => (
              <DetectedItemRow key={i.id} item={i} onGramsChange={onGramsChange} onPickCandidate={onPickCandidate} onReplace={(id) => setPicker({ itemId: id })} onRemove={onRemove} />
            ))}
          </div>
          <Button variant="ghost" className="w-full min-h-11 mt-1" onClick={() => setPicker({ itemId: null })}>
            <Plus aria-hidden /> Add item
          </Button>
        </div>

        <div className="animate-reveal animate-reveal-delay-2">
          <p className="text-[12px] font-bold text-muted-foreground mb-2">This meal</p>
          <NutrientPreview nutrition={totals} dim={items.length === 0} note={unresolved > 0 ? "Totals leave out items without a match." : null} />
        </div>

        <div className="animate-reveal animate-reveal-delay-3 space-y-4">
          <div>
            <p className="text-[12px] font-bold text-muted-foreground mb-1.5">Meal</p>
            <div className={SEGMENT_TRACK} role="group" aria-label="Meal slot">
              {MEAL_SLOTS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  aria-pressed={slot === s.key}
                  onClick={() => {
                    hapticSelection();
                    setSlot(s.key);
                  }}
                  className={cn("flex-1 h-11 rounded-lg text-[12px] font-black transition-all active:scale-[0.97]", slot === s.key ? SEGMENT_ACTIVE : SEGMENT_IDLE)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 min-h-11">
            <span className="flex-1 min-w-0">
              <span className="block text-[13px] font-semibold">Keep the photo</span>
              <span className="block text-[11px] text-muted-foreground mt-0.5">Off by default. Stored privately with the meal.</span>
            </span>
            <Switch checked={keepPhoto} onCheckedChange={setKeepPhoto} aria-label="Keep the photo" />
          </div>
          <Button size="lg" className="w-full" disabled={!canSave} loading={saving} onClick={save}>
            Add to diary
          </Button>
        </div>
      </div>
    );
  } else {
    body = (
      <div className="animate-reveal space-y-4">
        {photo()}
        <input
          type="text"
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          placeholder="What is it? e.g. lohta ja perunaa"
          aria-label="Hint for the scanner"
          className="w-full surface-inset rounded-xl h-11 px-3 text-[15px] outline-none focus:border-gold/50"
        />
        <p className="text-[12px] text-muted-foreground leading-snug">Optional. A word or two helps the scanner tell salmon from trout.</p>
        <Button size="lg" className="w-full" onClick={() => start(file)}>
          Scan this meal
        </Button>
        {fileInput("Choose another photo", "outline")}
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <NutritionPageBar title="Photo scan" onBack={leave} />
      <div className="px-4 pt-4 pb-28">{body}</div>

      <FoodPickerSheet open={picker !== null} onClose={() => setPicker(null)} onPick={(f) => void onPicked(f.id, f.name)} title={picker?.itemId ? "Replace with" : "Add item"} />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`${estimates} ${estimates === 1 ? "item is an estimate" : "items are estimates"}`}
        description="Check them, or add anyway — grams can still be edited in the diary."
        actionLabel="Add anyway"
        onConfirm={() => {
          setConfirmOpen(false);
          void commit();
        }}
      />
    </div>
  );
};

export default NutritionPhotoReview;
