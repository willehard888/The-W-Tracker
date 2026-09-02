import { useEffect, useRef, useState } from "react";

/**
 * Arms the shared `.commit-pop` class for one beat after `active` flips
 * false → true.
 *
 * The pop belongs to the user's action, never to a render. A check-in screen
 * that opens with three habits already ticked must be still — without the
 * mount guard below, every already-true item would spring at once on load,
 * which reads as a glitch rather than as feedback.
 *
 * `prev` is seeded with the value at mount, so the first pass can never
 * report a transition; only a genuine false → true afterwards arms the class.
 * Un-ticking is deliberately silent: undoing is not a commit.
 */
export const useCommitPop = (active: boolean, duration = 300): boolean => {
  const prev = useRef(active);
  const [popping, setPopping] = useState(false);

  useEffect(() => {
    const wasActive = prev.current;
    prev.current = active;
    // Reset on the non-transition paths too: an un-tick inside the pop window
    // clears the armed timer via cleanup, and without this the class would
    // stay stuck on — the next re-tick's setPopping(true) would no-op and
    // that commit would lose its pop.
    if (!active || wasActive) {
      setPopping(false);
      return;
    }

    setPopping(true);
    const timer = setTimeout(() => setPopping(false), duration);
    return () => clearTimeout(timer);
  }, [active, duration]);

  return popping;
};
