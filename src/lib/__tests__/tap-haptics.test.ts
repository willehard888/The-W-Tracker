import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const hapticImpact = vi.fn();
vi.mock("@/lib/haptics", () => ({ hapticImpact: (...a: unknown[]) => hapticImpact(...a) }));

import { installTapHaptics, tapTargetOf } from "@/lib/tap-haptics";

const mount = (html: string) => { document.body.innerHTML = html; return document.body.firstElementChild as HTMLElement; };

describe("tap haptics — every button, one feel", () => {
  beforeEach(() => { vi.useFakeTimers(); hapticImpact.mockClear(); document.body.innerHTML = ""; });
  afterEach(() => { vi.useRealTimers(); });

  it("fires for a button, a role=button and a tab, through a child target", () => {
    const stop = installTapHaptics(document);
    mount('<button><span>Go</span></button>').querySelector("span")!.click();
    mount('<div role="button">x</div>').click();
    mount('<div role="tab">t</div>').click();
    vi.runAllTimers();
    expect(hapticImpact).toHaveBeenCalledTimes(3);
    expect(hapticImpact).toHaveBeenCalledWith("light");
    stop();
    mount('<button>after</button>').click();
    vi.runAllTimers();
    expect(hapticImpact).toHaveBeenCalledTimes(3);
  });

  it("lets the handler's stronger tap play first (the light comes one task later)", () => {
    installTapHaptics(document);
    const b = mount('<button>Commit</button>');
    b.addEventListener("click", () => hapticImpact("medium"));
    b.click();
    expect(hapticImpact.mock.calls).toEqual([["medium"]]);
    vi.runAllTimers();
    expect(hapticImpact.mock.calls).toEqual([["medium"], ["light"]]);
  });

  it("stays silent for a disabled control, an aria-disabled link-button, an opted-out one and plain text", () => {
    installTapHaptics(document);
    expect(tapTargetOf(mount('<button disabled>x</button>'))).toBeNull();
    expect(tapTargetOf(mount('<a role="button" aria-disabled="true">x</a>'))).toBeNull();
    expect(tapTargetOf(mount('<nav data-no-haptic><button>tab</button></nav>').querySelector("button"))).toBeNull();
    expect(tapTargetOf(mount('<p>text</p>'))).toBeNull();
    for (const el of Array.from(document.body.children)) (el.querySelector("button") ?? (el as HTMLElement)).click();
    vi.runAllTimers();
    expect(hapticImpact).not.toHaveBeenCalled();
  });
});
