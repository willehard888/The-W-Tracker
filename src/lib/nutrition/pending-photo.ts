// Hand-off for a meal photo picked on one screen (Home camera button) and
// consumed on the next (/nutrition/photo). Module-level so no File goes
// through router state or storage; read-once so a stale photo never resurfaces.

let pending: File | null = null;

/** Stash (or clear) the photo the next review screen should open with. */
export function setPendingPhoto(file: File | null): void {
  pending = file;
}

/** Return the stashed photo and clear it. */
export function takePendingPhoto(): File | null {
  const f = pending;
  pending = null;
  return f;
}
