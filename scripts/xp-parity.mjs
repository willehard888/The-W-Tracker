#!/usr/bin/env node
// SQL ↔ TS parity for the day score.
//
// Runs every case in src/lib/__fixtures__/day-score-cases.json through
// `score_checkin` on a local Postgres (the :5499 dry-run cluster — see
// memory: nutrition-engine) and compares total, max, verified, every line's
// points and the training/sleep/mind sources with the fixture. The TS side is
// src/lib/__tests__/checkin-xp.test.ts on the same file, so a case that passes
// there and fails here is a client/server split.
//
//   node scripts/xp-parity.mjs [--db wf_xp] [--psql /path/to/psql]
//
// Everything runs inside one transaction that is rolled back.

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const DB = opt("--db", process.env.XP_PARITY_DB ?? "wf_xp");
const PSQL = opt("--psql", process.env.PSQL ?? "psql");
const PORT = opt("--port", "5499");

const cases = JSON.parse(readFileSync(new URL("../src/lib/__fixtures__/day-score-cases.json", import.meta.url), "utf8"));

// Column-backed chosen habits (src/lib/checkin-habits.ts); the rest go to the jsonb.
const COLUMN = {
  extra_workout: "extra_workout", healthy_food: "healthy_food", protein: "protein_intake",
  meditation_pm: "meditation_evening", no_phone_am: "no_phone_morning", no_phone_pm: "no_phone_evening",
  reading: "reading", cold_shower: "cold_shower",
};
const lit = (v) => (v == null ? "NULL" : typeof v === "number" ? String(v) : typeof v === "boolean" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

const sql = ["BEGIN;", "SET LOCAL client_min_messages = warning;"];
const ids = [];
for (const c of cases) {
  const uid = randomUUID();
  const cid = randomUUID();
  ids.push({ name: c.name, cid });
  const inp = c.input;
  const cols = { sleep_hours: inp.sleepHours, workout: inp.workout, hydration_liters: inp.hydrationLiters,
    meditation_morning: inp.meditationMorning, meditation_evening: inp.meditationMorning === undefined ? false : inp.meditationEvening };
  const jsonb = {};
  for (const k of inp.doneKeys) {
    if (COLUMN[k]) cols[COLUMN[k]] = true; else jsonb[k] = true;
  }
  sql.push(`INSERT INTO public.profiles (user_id, username, xp, level, checkin_habits) VALUES (${lit(uid)}, ${lit("p-" + uid.slice(0, 8))}, 0, 1, ${inp.chosenKeys.length ? `ARRAY[${inp.chosenKeys.map(lit).join(",")}]::text[]` : "NULL"});`);
  if (inp.age != null) sql.push(`INSERT INTO public.coach_athlete_profile (user_id, age) VALUES (${lit(uid)}, ${inp.age});`);
  const colNames = Object.keys(cols);
  sql.push(`INSERT INTO public.daily_checkins (id, user_id, checked_in_at, tz_offset_minutes, xp_earned, habits, ${colNames.join(", ")})
    VALUES (${lit(cid)}, ${lit(uid)}, now(), 0, 0, ${lit(JSON.stringify(jsonb))}::jsonb, ${colNames.map((k) => lit(cols[k])).join(", ")});`);
  if (inp.health) {
    const h = inp.health;
    sql.push(`INSERT INTO public.health_sync_snapshots (user_id, snapshot_date, steps, workout_minutes, workout_count, sleep_hours, mindful_minutes, workouts)
      VALUES (${lit(uid)}, (now() AT TIME ZONE 'UTC')::date, ${lit(h.steps)}, ${lit(h.workout_minutes)}, ${h.workouts.length}, ${lit(h.sleep_hours)}, ${lit(h.mindful_minutes)},
        ${lit(JSON.stringify(h.workouts.map((w) => ({ sport: "other", duration_min: w.duration_min, avg_hr: w.avg_hr ?? undefined, manual: w.manual || undefined }))))}::jsonb);`);
  }
  if (inp.appSessionToday) {
    sql.push(`INSERT INTO public.coach_program_logs (user_id, program_id, week, day_index, status, completed, logged_at) VALUES (${lit(uid)}, ${lit(randomUUID())}, 1, 1, 'done', true, now());`);
  }
  sql.push(`SELECT 'CASE ' || ${lit(cid)} || ' ' || public.score_checkin(${lit(cid)})::text;`);
}
sql.push("ROLLBACK;");

const run = spawnSync(PSQL, ["-h", "/tmp", "-p", PORT, "-U", "postgres", "-d", DB, "-At", "-v", "ON_ERROR_STOP=1"], {
  input: sql.join("\n"), encoding: "utf8", env: { ...process.env, LANG: "C", LC_ALL: "C" },
});
if (run.status !== 0) {
  console.error(run.stderr || run.stdout);
  process.exit(2);
}
const got = new Map();
for (const line of run.stdout.split("\n")) {
  const m = line.match(/^CASE (\S+) (.*)$/);
  if (m) got.set(m[1], JSON.parse(m[2]));
}

let failed = 0;
for (const c of cases) {
  const cid = ids.find((x) => x.name === c.name).cid;
  const s = got.get(cid);
  const problems = [];
  if (!s) { problems.push("no result"); }
  else {
    const pts = Object.fromEntries(s.lines.map((l) => [l.k, l.pts]));
    for (const [k, v] of Object.entries(c.expected.pts)) if (pts[k] !== v) problems.push(`${k}: sql ${pts[k]} ≠ ${v}`);
    if (s.total !== c.expected.total) problems.push(`total: sql ${s.total} ≠ ${c.expected.total}`);
    if (s.max !== c.expected.max) problems.push(`max: sql ${s.max} ≠ ${c.expected.max}`);
    if (s.verified !== c.expected.verified) problems.push(`verified: sql ${s.verified} ≠ ${c.expected.verified}`);
    for (const k of ["training", "sleep", "mind"]) {
      const line = s.lines.find((l) => l.k === k);
      if ((line.src ?? undefined) !== c.expected.src[k]) problems.push(`${k} src: sql ${line.src} ≠ ${c.expected.src[k]}`);
    }
  }
  if (problems.length) { failed++; console.log(`✗ ${c.name}\n    ${problems.join("\n    ")}`); }
  else console.log(`✓ ${c.name}`);
}
console.log(failed ? `\n${failed} of ${cases.length} cases split from SQL` : `\nall ${cases.length} cases agree SQL ↔ TS`);
process.exit(failed ? 1 : 0);
