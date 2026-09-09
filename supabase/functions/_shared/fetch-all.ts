/**
 * Read every row of a query, a page at a time.
 *
 * PostgREST caps an un-ranged select at max-rows (1000 on hosted projects)
 * and returns the first page with no error — a cron that reads "all active
 * users" simply stops seeing anyone past the cap, and nothing alerts. Every
 * function that derives its user set from a table goes through this.
 *
 * `build(from, to)` returns the query with `.range(from, to)` applied; the
 * query must carry a stable `.order()` so pages do not overlap.
 */
export const FETCH_PAGE = 1000;

export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>,
  page = FETCH_PAGE,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await build(from, from + page - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    all.push(...rows);
    if (rows.length < page) break;
  }
  return all;
}
