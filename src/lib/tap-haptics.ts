import { hapticImpact } from "@/lib/haptics";

// One tap haptic for every button in the document. The shared <Button> used
// to fire its own, and 84 raw buttons called one by hand while 183 stayed
// silent — so a tap felt different depending on which file the control was
// in. Delegated from the document, every button, [role="button"] and the
// like answers the same way; hapticImpact coalesces within 70 ms, so a
// handler that still fires its own never doubles the buzz.
//
// Opt out with data-no-haptic on a control that owns its own feel (the tab
// bar's pointer-down spring, the LOCK IN press-and-hold).
const TAP = 'button, [role="button"], [role="tab"], [role="menuitem"], [role="radio"], [role="switch"]';

export const tapTargetOf = (target: EventTarget | null): HTMLElement | null => {
  if (!(target instanceof Element)) return null;
  const el = target.closest<HTMLElement>(TAP);
  if (!el) return null;
  if (el.closest("[data-no-haptic]")) return null;
  if ((el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true") return null;
  return el;
};

export const installTapHaptics = (doc: Document = document): (() => void) => {
  const onClick = (e: Event) => { if (tapTargetOf(e.target)) void hapticImpact("light"); };
  // Capture: a handler that stops propagation still gets its tap.
  doc.addEventListener("click", onClick, true);
  return () => doc.removeEventListener("click", onClick, true);
};
