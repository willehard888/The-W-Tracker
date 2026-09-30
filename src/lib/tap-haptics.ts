import { hapticImpact } from "@/lib/haptics";

// One tap haptic for every button in the document. The shared <Button> used
// to fire its own, and 84 raw buttons called one by hand while 183 stayed
// silent — so a tap felt different depending on which file the control was
// in. Delegated from the document, every button, link, [role="button"] and
// the like answers the same way (a <Link> is a door here, not prose).
//
// The tap is deferred one task: click handlers run synchronously first, so a
// handler that wants a stronger tap (hapticImpact("medium") on a commit)
// plays it, and the delegate's light is then coalesced by the 70 ms window
// in hapticImpact. Fired in capture phase, the light played first and
// swallowed every medium in the app.
//
// Opt out with data-no-haptic on a control that owns its own feel (the tab
// bar's pointer-down spring, the LOCK IN press-and-hold).
const TAP = 'button, a[href], [role="button"], [role="tab"], [role="menuitem"], [role="radio"], [role="switch"]';

export const tapTargetOf = (target: EventTarget | null): HTMLElement | null => {
  if (!(target instanceof Element)) return null;
  const el = target.closest<HTMLElement>(TAP);
  if (!el) return null;
  if (el.closest("[data-no-haptic]")) return null;
  if ((el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true") return null;
  return el;
};

export const installTapHaptics = (doc: Document = document): (() => void) => {
  const onClick = (e: Event) => { if (tapTargetOf(e.target)) setTimeout(() => void hapticImpact("light"), 0); };
  // Capture: a handler that stops propagation still gets its tap.
  doc.addEventListener("click", onClick, true);
  return () => doc.removeEventListener("click", onClick, true);
};
