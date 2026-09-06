import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Plus, Star, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import EmptyState from "@/components/ui/empty-state";
import MoreSection from "@/components/ui/more-section";
import { Block } from "@/components/skeletons/PageSkeleton";
import { cn } from "@/lib/utils";
import { hapticSelection } from "@/lib/haptics";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import PageBar from "@/components/ui/page-bar";
import NumField from "@/components/nutrition/NumField";
import MacroRow from "@/components/nutrition/MacroRow";
import { useFood } from "@/hooks/use-food";
import { useNutrientDefinitions } from "@/hooks/use-nutrient-definitions";
import { useUserFoods } from "@/hooks/use-user-foods";
import { touchFood } from "@/lib/nutrition/food-cache";
import { fmtKcal } from "@/lib/nutrition/format";
import { fetchFood, type UserFoodPayload } from "@/lib/nutrition/queries";
import { parseQty } from "@/lib/nutrition/resolve-grams";
import { BASE_KEYS } from "@/lib/nutrition/scale";
import type { NutrientKey } from "@/lib/nutrition/types";

const REQUIRED: readonly NutrientKey[] = ["kcal", "protein_g", "carbs_g", "fat_g"];
const SECONDARY: readonly { key: NutrientKey; label: string; unit: string }[] = [
  { key: "fiber_g", label: "Fiber", unit: "g" },
  { key: "sugar_g", label: "Sugar", unit: "g" },
  { key: "sat_fat_g", label: "Saturated fat", unit: "g" },
  { key: "sodium_mg", label: "Sodium", unit: "mg" },
];
const SHOWN = new Set<NutrientKey>([...REQUIRED, ...SECONDARY.map((s) => s.key)]);
const MORE_KEYS = BASE_KEYS.filter((k) => !SHOWN.has(k));
const PRIMARY_LABEL: Record<string, string> = { kcal: "Calories", protein_g: "Protein", carbs_g: "Carbs", fat_g: "Fat" };

type Nutrients = Partial<Record<NutrientKey, string>>;
type ServingRow = { key: number; label: string; grams: string; is_default: boolean };
type Errors = { name?: string; nutrients: Partial<Record<NutrientKey, string>>; servings: Record<number, string> };

const unitOf = (key: string, fromDefs?: string | null) => fromDefs ?? (key === "kcal" ? "kcal" : key.split("_").pop() ?? "");
const titleCase = (key: string) => key.replace(/_(g|mg|ug)$/, "").replace(/_/g, " ").replace(/^vit /, "vitamin ").replace(/^\w/, (c) => c.toUpperCase());
const n0 = (s: string | undefined) => parseQty(s ?? "") ?? 0;
let servingSeq = 0;
const newServing = (label = "", grams = ""): ServingRow => ({ key: ++servingSeq, label, grams, is_default: false });

/**
 * A food label, typed once. Per-100 g is the only unit the engine stores,
 * so the form is per-100 g too; servings are labelled weights on top. The
 * live MacroRow is the hero — you see the food the diary will log while
 * you type — and the kcal-versus-macros note catches a mistyped label
 * before it becomes a wrong day. Validation is inline; nothing toasts.
 */
const UserFoodEditor = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const { save, remove, saving } = useUserFoods();
  const { byKey } = useNutrientDefinitions();
  const existing = useFood(id ?? null);

  // A label photo (from=label) or a barcode miss pre-fills the form through the query string; every value stays editable.
  const fromLabel = params.get("from") === "label";
  const [name, setName] = useState(params.get("name") ?? "");
  const [brand, setBrand] = useState(params.get("brand") ?? "");
  const [barcode, setBarcode] = useState(params.get("barcode") ?? "");
  const [nutrients, setNutrients] = useState<Nutrients>(() => {
    const next: Nutrients = {};
    for (const k of BASE_KEYS) {
      const v = params.get(k);
      if (v && parseQty(v) !== null) next[k] = v;
    }
    return next;
  });
  const [servings, setServings] = useState<ServingRow[]>(() => {
    const g = params.get("serving_g");
    return g && parseQty(g) ? [{ ...newServing(params.get("serving_label") || "1 serving", g), is_default: true }] : [];
  });
  const [errors, setErrors] = useState<Errors>({ nutrients: {}, servings: {} });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const prefilled = useRef(false);

  // Edit mode: fill the form once from the stored food (later refetches must not clobber typing).
  useEffect(() => {
    const f = existing.food;
    if (!id || !f || prefilled.current) return;
    prefilled.current = true;
    setName(f.name);
    setBrand(f.brand ?? "");
    const next: Nutrients = {};
    for (const k of BASE_KEYS) if (f.per100g[k] !== undefined) next[k] = String(f.per100g[k]);
    setNutrients(next);
    setServings(f.servings.filter((s) => s.grams != null).map((s) => ({ ...newServing(s.label, String(s.grams)), is_default: s.id === f.defaultServingId })));
  }, [id, existing.food]);

  const setNutrient = (k: NutrientKey, v: string) => {
    setNutrients((n) => ({ ...n, [k]: v }));
    if (errors.nutrients[k]) setErrors((e) => ({ ...e, nutrients: { ...e.nutrients, [k]: undefined } }));
  };
  const updateServing = (key: number, patch: Partial<ServingRow>) =>
    setServings((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : patch.is_default ? { ...r, is_default: false } : r)));

  const kcal = n0(nutrients.kcal);
  const macroKcal = 4 * n0(nutrients.protein_g) + 4 * n0(nutrients.carbs_g) + 9 * n0(nutrients.fat_g);
  const sanity = Math.max(kcal, macroKcal) > 0 && Math.abs(kcal - macroKcal) > 0.25 * Math.max(kcal, macroKcal);

  const validate = (): UserFoodPayload | null => {
    const next: Errors = { nutrients: {}, servings: {} };
    if (!name.trim()) next.name = "Give the food a name";
    const vector: UserFoodPayload["nutrients"] = {};
    for (const k of BASE_KEYS) {
      const raw = (nutrients[k] ?? "").trim();
      if (raw === "") {
        if (REQUIRED.includes(k)) next.nutrients[k] = "Required";
        continue;
      }
      const v = parseQty(raw);
      if (v === null) next.nutrients[k] = "Enter a number";
      else vector[k] = v;
    }
    const rows: NonNullable<UserFoodPayload["servings"]> = [];
    servings.forEach((s, i) => {
      const g = parseQty(s.grams);
      if (!s.label.trim()) next.servings[s.key] = "Name the serving (e.g. 1 slice)";
      else if (g === null || g <= 0) next.servings[s.key] = "Weight in grams";
      else rows.push({ label: s.label.trim(), grams: g, is_default: s.is_default, sort_order: i });
    });
    setErrors(next);
    if (next.name || Object.keys(next.nutrients).length || Object.keys(next.servings).length) return null;
    return { id, name: name.trim(), brand: brand.trim() || null, barcode: barcode.trim() || null, nutrients: vector, servings: rows };
  };

  const submit = async () => {
    const payload = validate();
    if (!payload) return;
    setBusy(true);
    try {
      const savedId = await save(payload);
      const food = await fetchFood(supabase, savedId).catch(() => null);
      if (food && user?.id) touchFood(user.id, food);
      const q = new URLSearchParams();
      for (const k of ["date", "slot"]) {
        const v = params.get(k);
        if (v) q.set(k, v);
      }
      q.set("add", savedId);
      navigate(`/nutrition?${q.toString()}`, { replace: true });
    } catch {
      /* the hook already toasted */
    } finally {
      setBusy(false);
    }
  };
  const destroy = async () => {
    if (!id) return;
    setConfirmDelete(false);
    try {
      await remove(id);
      navigate("/nutrition");
    } catch {
      /* the hook already toasted */
    }
  };

  const title = id ? "Edit food" : "New food";
  if (id && existing.isLoading && !existing.food) {
    return (
      <div className="min-h-full">
        <PageBar title={title} onBack={() => navigate(-1)} />
        <div className="px-4 pt-4 pb-8">
          <Block height={52} className="!rounded-xl" />
          <Block height={88} delay={40} className="mt-4 !rounded-2xl" />
          <Block height={200} delay={80} className="mt-4" />
        </div>
      </div>
    );
  }
  if (id && !existing.isLoading && !existing.food) {
    return (
      <div className="min-h-full">
        <PageBar title={title} onBack={() => navigate(-1)} />
        <div className="px-4 pt-6">
          <EmptyState title="Food not found" description="It may have been deleted." action={<Button variant="outline" onClick={() => navigate("/nutrition")}>Back to the diary</Button>} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <PageBar
        title={title}
        onBack={() => navigate(-1)}
        action={
          id ? (
            <Button variant="ghost" size="icon" aria-label="Delete food" className="text-muted-foreground" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={18} />
            </Button>
          ) : undefined
        }
      />

      <form
        className="px-4 pt-4 pb-6 space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        noValidate
      >
        <div className="home-rise space-y-3">
          {fromLabel && <p className="text-[12px] text-muted-foreground leading-snug">Read from a label photo — check every number before saving.</p>}
          <label className="block">
            <span className="sr-only">Food name</span>
            <input
              type="text"
              value={name}
              autoFocus={!id}
              placeholder="Food name"
              aria-label="Food name"
              aria-required
              aria-invalid={!!errors.name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((er) => ({ ...er, name: undefined }));
              }}
              className={cn(
                "w-full bg-transparent border-b border-border/60 py-2 font-display text-[24px] font-black tracking-tight leading-tight outline-none focus:border-gold/50 transition-colors placeholder:text-muted-foreground/40",
                errors.name && "border-destructive/60",
              )}
            />
            {errors.name && (
              <span role="alert" className="block text-[11px] text-[hsl(var(--ember))] mt-1">
                {errors.name}
              </span>
            )}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[12px] font-bold text-muted-foreground">Brand</span>
              <input type="text" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Optional" className="mt-1 w-full surface-inset rounded-xl h-11 px-3 text-[15px] font-bold outline-none focus:border-gold/50" />
            </label>
            <NumField label="Barcode" mode="numeric" value={barcode} onChange={setBarcode} placeholder="Optional" />
          </div>
        </div>

        <div className="home-rise home-rise-1">
          <p className="text-[12px] font-bold text-muted-foreground mb-2">Per 100 g</p>
          <MacroRow nutrition={{ calories: kcal, protein: n0(nutrients.protein_g), carbs: n0(nutrients.carbs_g), fat: n0(nutrients.fat_g) }} />
          {sanity && (
            <p role="status" className="text-[12px] text-[hsl(var(--ember))] mt-2 leading-snug">
              Check the label — the macros add up to about {fmtKcal(macroKcal)} kcal.
            </p>
          )}
        </div>

        <div className="home-rise home-rise-2 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {REQUIRED.map((k) => (
              <NumField key={k} label={PRIMARY_LABEL[k]} unit={unitOf(k)} required value={nutrients[k] ?? ""} onChange={(v) => setNutrient(k, v)} error={errors.nutrients[k]} />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {SECONDARY.map((s) => (
              <NumField key={s.key} label={s.label} unit={s.unit} value={nutrients[s.key] ?? ""} onChange={(v) => setNutrient(s.key, v)} error={errors.nutrients[s.key]} />
            ))}
          </div>
          <MoreSection label="More nutrients">
            <div className="grid grid-cols-2 gap-3">
              {MORE_KEYS.map((k) => {
                const def = byKey.get(k);
                return <NumField key={k} label={def?.name_en ?? titleCase(k)} unit={unitOf(k, def?.unit)} value={nutrients[k] ?? ""} onChange={(v) => setNutrient(k, v)} error={errors.nutrients[k]} />;
              })}
            </div>
            <p className="text-[11px] text-muted-foreground/80 mt-3 leading-snug">Blank means unknown. The diary shows a dash, never a zero.</p>
          </MoreSection>
        </div>

        <div className="home-rise home-rise-3">
          <div className="flex items-center justify-between gap-3 mb-1">
            <p className="text-[12px] font-bold text-muted-foreground">Servings</p>
            <Button type="button" variant="ghost" size="xs" onClick={() => setServings((r) => [...r, newServing()])}>
              <Plus aria-hidden /> Add serving
            </Button>
          </div>
          {servings.length === 0 ? (
            <p className="text-[12px] text-muted-foreground leading-snug">Optional. “1 slice · 30 g” makes logging one tap.</p>
          ) : (
            <div className="divide-y divide-border/35">
              {servings.map((s) => (
                <div key={s.key} className="py-2.5">
                  <div className="flex items-end gap-2">
                    <label className="flex-1 min-w-0 block">
                      <span className="text-[11px] font-bold text-muted-foreground">Label</span>
                      <input
                        type="text"
                        value={s.label}
                        placeholder="1 slice"
                        aria-label="Serving label"
                        onChange={(e) => updateServing(s.key, { label: e.target.value })}
                        className="mt-1 w-full surface-inset rounded-xl h-11 px-3 text-[15px] font-bold outline-none focus:border-gold/50"
                      />
                    </label>
                    <NumField label="Grams" className="w-24" value={s.grams} onChange={(v) => updateServing(s.key, { grams: v })} />
                    <button
                      type="button"
                      aria-label={s.is_default ? "Default serving" : "Make default serving"}
                      aria-pressed={s.is_default}
                      onClick={() => {
                        hapticSelection();
                        updateServing(s.key, { is_default: !s.is_default });
                      }}
                      className={cn("press shrink-0 h-11 w-11 flex items-center justify-center rounded-xl transition-transform", s.is_default ? "text-gold" : "text-muted-foreground/50")}
                    >
                      <Star size={16} fill={s.is_default ? "currentColor" : "none"} />
                    </button>
                    <button
                      type="button"
                      aria-label="Remove serving"
                      onClick={() => setServings((rows) => rows.filter((r) => r.key !== s.key))}
                      className="press shrink-0 h-11 w-11 flex items-center justify-center rounded-xl text-muted-foreground transition-transform"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  {errors.servings[s.key] && (
                    <p role="alert" className="text-[11px] text-[hsl(var(--ember))] mt-1">
                      {errors.servings[s.key]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="home-rise home-rise-4">
          <Button type="submit" size="lg" className="w-full" loading={busy || saving} disabled={busy || saving}>
            {id ? "Save changes" : "Save food"}
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this food?"
        description="Meals you already logged keep their numbers. It just stops showing up in search."
        onConfirm={() => void destroy()}
      />
    </div>
  );
};

export default UserFoodEditor;
