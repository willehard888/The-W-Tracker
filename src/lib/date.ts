/**
 * YYYY-MM-DD in the device's LOCAL calendar — the app's one day key.
 *
 * `new Date().toISOString().slice(0, 10)` is the wrong answer to this question:
 * it is UTC, so for a user in Finland every evening after ~21:00 lands in
 * tomorrow's bucket. Three call sites encoded the day that way and quietly
 * disagreed with the diary, the streak and the server for those three hours.
 */
export const localDateKey = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
