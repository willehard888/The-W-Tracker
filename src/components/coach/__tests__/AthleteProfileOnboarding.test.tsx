import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AthleteProfileOnboarding, { EXPERIENCE, mergeDraft } from "@/components/coach/AthleteProfileOnboarding";

/**
 * The experience question is the one answer the wizard may not guess: a null
 * reads as "experienced" downstream and puts a first-timer under a barbell.
 * The redesign changed every option into a row; the gate must still hold.
 *
 * The groups below it cover the crash a new athlete hit on first open. A draft
 * left on the device — by an older build, or by the account that used the phone
 * before — was loaded INSTEAD of the defaults, so every chip row read
 * `.includes` of a field that was not in it and the screen died on mount.
 */

vi.mock("@/hooks/use-athlete-profile", () => ({
  useAthleteProfile: () => ({ profile: null, upsert: vi.fn(), isSaving: false }),
}));

const USER_ID = "athlete-1";
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: USER_ID } }),
}));

// The step transition is a 200 ms exit-then-enter; under a loaded suite jsdom
// takes seconds to play it. The gate is what is under test, not the slide.
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: { div: ({ children }: { children: React.ReactNode }) => <div>{children}</div> },
  // The app renders through `m` (LazyMotion) now; same stand-in under both names.
  m: { div: ({ children }: { children: React.ReactNode }) => <div>{children}</div> },
}));

const DRAFT = `w_coach_onboarding_draft_v2_${USER_ID}`;
const STEP = `w_coach_onboarding_step_v2_${USER_ID}`;
const LEGACY_DRAFT = "w_coach_onboarding_draft_v2";
const LEGACY_STEP = "w_coach_onboarding_step_v2";

/** Walk forward through the wizard; the chip rows live on the later steps. */
const walkTo = (n: number) => {
  for (let i = 1; i < n; i++) {
    const next = screen.queryByRole("button", { name: /Next/ });
    if (!next || (next as HTMLButtonElement).disabled) return;
    fireEvent.click(next);
  }
};

describe("AthleteProfileOnboarding", () => {
  beforeEach(() => localStorage.clear());

  it("holds Next on the experience step until an answer is chosen", () => {
    render(<AthleteProfileOnboarding onDone={() => {}} />);

    expect(screen.getByText("1/6")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));

    expect(screen.getByRole("heading", { name: "Have you trained before?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Next/ })).toBeDisabled();

    const first = screen.getByRole("button", { name: new RegExp(EXPERIENCE[0].label) });
    fireEvent.click(first);

    expect(first).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Next/ })).toBeEnabled();
    expect(JSON.parse(localStorage.getItem(DRAFT)!).training_experience).toBe("never_trained");
  });
});

describe("a draft that predates the questions in it", () => {
  beforeEach(() => localStorage.clear());

  it("renders when the saved draft is missing the newer fields", () => {
    // Exactly the shape an older build left behind: no hobbies, no
    // mental_health_focus. This threw on mount.
    localStorage.setItem(
      DRAFT,
      JSON.stringify({ age: 30, primary_goal: "all", sports: [], equipment: [], injuries: [], dietary: [] }),
    );

    expect(() => render(<AthleteProfileOnboarding onDone={() => {}} />)).not.toThrow();
    expect(() => walkTo(6)).not.toThrow();
  });

  it("keeps the answers that ARE in the saved draft", () => {
    localStorage.setItem(DRAFT, JSON.stringify({ primary_goal: "strength" }));
    render(<AthleteProfileOnboarding onDone={() => {}} />);
    expect(screen.getByRole("button", { name: /Get stronger/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("survives a list field stored as null rather than absent", () => {
    localStorage.setItem(DRAFT, JSON.stringify({ hobbies: null, mental_health_focus: null, dietary: null }));
    expect(() => render(<AthleteProfileOnboarding onDone={() => {}} />)).not.toThrow();
    expect(() => walkTo(6)).not.toThrow();
  });

  it("survives a draft that is not an object at all", () => {
    localStorage.setItem(DRAFT, "[1,2,3]");
    expect(() => render(<AthleteProfileOnboarding onDone={() => {}} />)).not.toThrow();
    expect(screen.getByText("1/6")).toBeInTheDocument();
  });

  it("survives unparseable storage", () => {
    localStorage.setItem(DRAFT, "{not json");
    expect(() => render(<AthleteProfileOnboarding onDone={() => {}} />)).not.toThrow();
  });
});

describe("the draft belongs to the athlete, not the device", () => {
  beforeEach(() => localStorage.clear());

  it("ignores a draft left under the old shared key", () => {
    // Somebody else's half-finished answers, or this device's previous account.
    localStorage.setItem(LEGACY_DRAFT, JSON.stringify({ primary_goal: "fat_loss" }));
    localStorage.setItem(LEGACY_STEP, "4");

    render(<AthleteProfileOnboarding onDone={() => {}} />);

    expect(screen.getByText("1/6")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Lose fat/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("clears the old shared key so it cannot be picked up again", () => {
    localStorage.setItem(LEGACY_DRAFT, JSON.stringify({ primary_goal: "fat_loss" }));
    localStorage.setItem(LEGACY_STEP, "4");

    render(<AthleteProfileOnboarding onDone={() => {}} />);

    expect(localStorage.getItem(LEGACY_DRAFT)).toBeNull();
    expect(localStorage.getItem(LEGACY_STEP)).toBeNull();
  });

  it("writes under the athlete's own key", () => {
    render(<AthleteProfileOnboarding onDone={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Build muscle/ }));

    expect(JSON.parse(localStorage.getItem(DRAFT)!).primary_goal).toBe("hypertrophy");
    expect(localStorage.getItem(LEGACY_DRAFT)).toBeNull();
    expect(localStorage.getItem(STEP)).not.toBeNull();
  });
});

/**
 * The merge on its own, because the rendering tests above cannot prove it: the
 * key changed in the same commit, so on the old code they simply read an empty
 * key and never reached the crash. This is the half that did.
 */
describe("mergeDraft", () => {
  const defaults = { age: 30, primary_goal: "all", hobbies: [], dietary: ["Omnivore"], sports: [] };

  it("fills in a field the saved draft has never heard of", () => {
    const merged = mergeDraft(defaults, { age: 41, primary_goal: "strength" });
    expect(merged.hobbies).toEqual([]);
    expect(merged.sports).toEqual([]);
  });

  it("does not overwrite what the athlete actually answered", () => {
    const merged = mergeDraft(defaults, { age: 41, hobbies: ["Music"] });
    expect(merged.age).toBe(41);
    expect(merged.hobbies).toEqual(["Music"]);
  });

  it("repairs a list field stored as something that is not a list", () => {
    for (const bad of [null, undefined, "Music", 7, {}]) {
      expect(mergeDraft(defaults, { hobbies: bad }).hobbies).toEqual([]);
    }
  });

  it("falls back to a list field's own default, not to empty", () => {
    expect(mergeDraft(defaults, { dietary: null }).dietary).toEqual(["Omnivore"]);
  });

  it("is the defaults when there is no draft at all", () => {
    expect(mergeDraft(defaults, null)).toEqual(defaults);
  });
});
