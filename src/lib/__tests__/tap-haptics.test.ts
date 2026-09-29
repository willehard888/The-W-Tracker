import { describe, it, expect, vi, beforeEach } from "vitest";

const hapticImpact = vi.fn();
vi.mock("@/lib/haptics", () => ({ hapticImpact: (...a: unknown[]) => hapticImpact(...a) }));

import { installTapHaptics, tapTargetOf } from "@/lib/tap-haptics";

const mount = (html: string) => { document.body.innerHTML = html; return document.body.firstElementChild as HTMLElement; };

describe("tap haptics — every button, one feel", () => {
  beforeEach(() => { hapticImpact.mockClear(); document.body.innerHTML = ""; });

  it("fires for a button, a role=button and a tab, through a child target", () => {
    const stop = installTapHaptics(document);
    mount('<button><span>Go</span></button>').querySelector("span")!.click();
    mount('<div role="button">x</div>').click();
    mount('<div role="tab">t</div>').click();
    expect(hapticImpact).toHaveBeenCalledTimes(3);
    expect(hapticImpact).toHaveBeenCalledWith("light");
    stop();
    mount('<button>after</button>').click();
    expect(hapticImpact).toHaveBeenCalledTimes(3);
  });

  it("stays silent for a disabled control, an aria-disabled link-button, an opted-out one and plain text", () => {
    installTapHaptics(document);
    expect(tapTargetOf(mount('<button disabled>x</button>'))).toBeNull();
    expect(tapTargetOf(mount('<a role="button" aria-disabled="true">x</a>'))).toBeNull();
    expect(tapTargetOf(mount('<nav data-no-haptic><button>tab</button></nav>').querySelector("button"))).toBeNull();
    expect(tapTargetOf(mount('<p>text</p>'))).toBeNull();
    for (const el of Array.from(document.body.children)) (el.querySelector("button") ?? (el as HTMLElement)).click();
    expect(hapticImpact).not.toHaveBeenCalled();
  });
});
