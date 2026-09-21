import "@/test/route-mocks";
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { act, cleanup, screen, waitFor } from "@testing-library/react";
import { setMode, STUB_ERROR, type StubMode } from "@/test/supabase-stub";
import { mountRoute, watchConsole } from "@/test/mount-route";

import Coach from "@/pages/Coach";
import AthleteProfileSettings from "@/pages/AthleteProfileSettings";
import CoachReflect from "@/pages/CoachReflect";
import CoachGoal from "@/pages/CoachGoal";
import CoachProgress from "@/pages/CoachProgress";
import Journey from "@/pages/Journey";
import CoachProgramDetail from "@/pages/CoachProgramDetail";
import CoachSession from "@/pages/CoachSession";
import CoachMemoryScreen from "@/pages/CoachMemoryScreen";
import Recovery from "@/pages/Recovery";
import Vault from "@/pages/Vault";
import Recipes from "@/pages/Recipes";
import Exercises from "@/pages/Exercises";
import NutritionDiary from "@/pages/nutrition/NutritionDiary";
import NutritionPhotoReview from "@/pages/nutrition/NutritionPhotoReview";
import NutritionTargets from "@/pages/nutrition/NutritionTargets";
import UserFoodEditor from "@/pages/nutrition/UserFoodEditor";
import NutritionRecipes from "@/pages/nutrition/NutritionRecipes";
import NutritionRecipeEditor from "@/pages/nutrition/NutritionRecipeEditor";
import WeeklyBriefing from "@/pages/WeeklyBriefing";

// Coach, training, fuel, library, recovery, vault — see routes.home-squad
// for what a row asserts and why.
type Row = { path: string; pattern: string; page: React.ComponentType; expect: RegExp | string };

const ROWS: Row[] = [
  { path: "/coach", pattern: "/coach", page: Coach, expect: /coach/i },
  { path: "/coach/profile", pattern: "/coach/profile", page: AthleteProfileSettings, expect: /athlete profile/i },
  { path: "/coach/reflect", pattern: "/coach/reflect", page: CoachReflect, expect: /reflection/i },
  { path: "/coach/goal", pattern: "/coach/goal", page: CoachGoal, expect: /goal/i },
  { path: "/coach/progress", pattern: "/coach/progress", page: CoachProgress, expect: /progress/i },
  { path: "/journey", pattern: "/journey", page: Journey, expect: /journey/i },
  { path: "/coach/program", pattern: "/coach/program", page: CoachProgramDetail, expect: /program/i },
  { path: "/coach/session/1/1", pattern: "/coach/session/:week/:day", page: CoachSession, expect: /back|session/i },
  { path: "/coach/memory", pattern: "/coach/memory", page: CoachMemoryScreen, expect: /memory/i },
  { path: "/recovery", pattern: "/recovery", page: Recovery, expect: /recovery/i },
  { path: "/recovery?routine=no-such-routine", pattern: "/recovery", page: Recovery, expect: /recovery/i },
  { path: "/vault", pattern: "/vault", page: Vault, expect: /vault/i },
  { path: "/recipes", pattern: "/recipes/:id?", page: Recipes, expect: /recipes/i },
  { path: "/exercises", pattern: "/exercises/:slug?", page: Exercises, expect: /exercise/i },
  { path: "/exercises/no-such-movement", pattern: "/exercises/:slug?", page: Exercises, expect: /library/i },
  { path: "/nutrition", pattern: "/nutrition", page: NutritionDiary, expect: /diary|nutrition/i },
  { path: "/nutrition/photo", pattern: "/nutrition/photo", page: NutritionPhotoReview, expect: /scan/i },
  { path: "/nutrition/targets", pattern: "/nutrition/targets", page: NutritionTargets, expect: /targets/i },
  { path: "/nutrition/foods/new", pattern: "/nutrition/foods/new", page: UserFoodEditor, expect: /food/i },
  { path: "/nutrition/foods/f1/edit", pattern: "/nutrition/foods/:id/edit", page: UserFoodEditor, expect: /food/i },
  { path: "/nutrition/recipes", pattern: "/nutrition/recipes", page: NutritionRecipes, expect: /recipes/i },
  { path: "/nutrition/recipes/new", pattern: "/nutrition/recipes/new", page: NutritionRecipeEditor, expect: /recipe/i },
  { path: "/nutrition/recipes/r1", pattern: "/nutrition/recipes/:id", page: NutritionRecipeEditor, expect: /recipe/i },
  { path: "/briefing/b1", pattern: "/briefing/:id", page: WeeklyBriefing, expect: /briefing/i },
];

describe.each<StubMode>(["empty", "error"])("coach and fuel routes mount cleanly (%s data)", (mode) => {
  let watch: ReturnType<typeof watchConsole>;
  beforeEach(() => { setMode(mode); watch = watchConsole(); });
  afterEach(() => { watch.stop(); cleanup(); });

  it.each(ROWS)("$path", async ({ path, pattern, page, expect: expected }) => {
    mountRoute(pattern, path, page);
    await waitFor(() => {
      const found =
        screen.queryAllByLabelText(expected).length > 0 ||
        screen.queryAllByText(expected).length > 0 ||
        screen.queryAllByRole("button", { name: expected }).length > 0;
      expect(found).toBe(true);
    }, { timeout: 4000 });
    await act(() => new Promise((r) => setTimeout(r, 50)));
    expect(watch.errors.filter((e) => !(mode === "error" && e.includes(STUB_ERROR)))).toEqual([]);
  });
});
