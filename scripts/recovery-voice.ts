// The spoken half of the twelve guided sessions — generated, not recorded.
//
// One file per voiced routine (src/lib/recovery/voice.ts VOICED + FILE): the
// same lines the screen shows, spoken at the same seconds, silence between.
// A guided movement speaks its `cues`; a breathing movement speaks its
// `steps` once and then the pacer's words ("Breathe in", "Hold", "Breathe
// out") at every phase boundary, because the pacer is what the eyes would be
// following and they are closed.
//
// The 2026-09-20 files were 94 minutes of digital silence (every second's
// peak measured 0.0000), which is why this script ends by measuring what it
// wrote: `--check` decodes every file and fails unless the loud seconds match
// the script. Run with `--check` alone to verify what is in the repo.
//
//   eval "$(grep '^export OPENAI_API_KEY=' ~/.zshrc | tail -1)"
//   npx vite-node scripts/recovery-voice.ts            # generate + check
//   npx vite-node scripts/recovery-voice.ts --check    # check only
//
// Pipeline: OpenAI audio/speech (gpt-4o-mini-tts, voice marin, raw PCM 24 kHz
// mono) → one PCM buffer per routine with each line at its second → WAV →
// afconvert (CoreAudio, present on every Mac; there is no ffmpeg here) → AAC
// in an .m4a, mono, 32 kbps. Segments are cached by text hash in the
// scratchpad so a re-run bills only what changed.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROUTINE_BY_ID, routineMovements } from "../src/data/recovery-routines";
import { movementSeconds, type RecoveryMovement } from "../src/data/recovery";
import { VOICED_ROUTINES, voiceFile } from "../src/lib/recovery/voice";

const RATE = 24_000; // OpenAI pcm: 24 kHz, 16-bit signed LE, mono
const VOICE = "marin";
const MODEL = "gpt-4o-mini-tts";
const OUT_DIR = join(process.cwd(), "public", "audio", "recovery");
const CACHE_DIR = join(process.env.SCRATCH ?? join(process.cwd(), ".voice-cache"), "voice-segments");
const CHECK_ONLY = process.argv.includes("--check");
const ONLY = process.argv.find((a) => a.startsWith("--only="))?.slice(7);

const WORD: Record<string, string> = { In: "Breathe in", Hold: "Hold", Out: "Breathe out" };

interface Line { at: number; text: string }

const segmentPath = (text: string) => join(CACHE_DIR, createHash("sha1").update(`${MODEL}|${VOICE}|${text}`).digest("hex") + ".pcm");

/** Seconds a line takes to say — from the cached segment, or an estimate before it exists. */
const spokenSeconds = (text: string): number => {
  const cached = segmentPath(text);
  if (existsSync(cached)) return readFileSync(cached).length / 2 / RATE;
  return 0.35 + text.length * 0.075; // marin at speed 0.9, measured over the guided scripts
};

/** What a movement says, and when, relative to its own start. */
const linesFor = (m: RecoveryMovement): Line[] => {
  if (m.cues) return m.cues.map(([at, text]) => ({ at, text }));
  if (m.pace) {
    // The instructions once; then the pacer's words for the rest of the hold,
    // starting at the first cycle boundary after the instructions have been
    // said. Two inhales in a row (the physiological sigh) are one line —
    // "Breathe in, and again" — because the second phase is a second long.
    const cycle = m.pace.reduce((s, [, sec]) => s + sec, 0);
    const intro = m.steps.join(" ");
    const lines: Line[] = [{ at: 0, text: intro }];
    const first = Math.ceil(spokenSeconds(intro) / cycle) * cycle;
    for (let t = first; t < m.holdSec - 2; t += cycle) {
      let p = t;
      for (let i = 0; i < m.pace.length; i++) {
        const [label, sec] = m.pace[i];
        const doubled = label === "In" && m.pace[i + 1]?.[0] === "In";
        if (p < m.holdSec - 1) lines.push({ at: p, text: doubled ? "Breathe in, and again" : WORD[label] ?? label });
        p += sec;
        if (doubled) { p += m.pace[i + 1][1]; i++; }
      }
    }
    return lines;
  }
  return [{ at: 0, text: m.steps.join(" ") }];
};

/** The whole routine's script: every movement's lines, offset by what came before. */
const scriptFor = (routineId: string): { lines: Line[]; totalSec: number } => {
  const routine = ROUTINE_BY_ID.get(routineId);
  if (!routine) throw new Error(`no routine ${routineId}`);
  const movements = routineMovements(routine);
  const lines: Line[] = [];
  let offset = 0;
  for (const m of movements) {
    for (const l of linesFor(m)) lines.push({ at: offset + l.at, text: l.text });
    offset += movementSeconds(m);
  }
  return { lines, totalSec: offset };
};

// ── TTS ─────────────────────────────────────────────────────────────────────

const tts = async (text: string): Promise<Buffer> => {
  const cached = segmentPath(text);
  if (existsSync(cached)) return readFileSync(cached);
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set (eval the export from ~/.zshrc)");
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      voice: VOICE,
      input: text,
      response_format: "pcm",
      speed: 0.9,
      instructions:
        "A calm, low, unhurried voice guiding someone whose eyes are closed. Speak slowly and softly, with short natural pauses. No enthusiasm, no emphasis, no announcer tone.",
    }),
  });
  if (!res.ok) throw new Error(`tts ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const buf = Buffer.from(await res.arrayBuffer());
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cached, buf);
  return buf;
};

// ── Assembly ────────────────────────────────────────────────────────────────
const FADE = Math.round(RATE * 0.08);

/** Place each segment at its second; a segment that would run into the next line is faded out at the boundary. */
const assemble = (lines: Line[], segments: Buffer[], totalSec: number, name: string): Buffer => {
  const out = Buffer.alloc(totalSec * RATE * 2); // silence
  lines.forEach((l, i) => {
    const seg = segments[i];
    const start = Math.round(l.at * RATE);
    const next = i + 1 < lines.length ? Math.round(lines[i + 1].at * RATE) : totalSec * RATE;
    const room = Math.min(next - start, totalSec * RATE - start);
    let samples = seg.length / 2;
    if (samples > room) {
      console.warn(`  ${name} @${l.at}s: "${l.text.slice(0, 40)}…" runs ${((samples - room) / RATE).toFixed(1)}s past the next line — faded`);
      samples = room;
    }
    for (let s = 0; s < samples; s++) {
      let v = seg.readInt16LE(s * 2);
      if (s > samples - FADE) v = Math.round(v * ((samples - s) / FADE));
      out.writeInt16LE(v, (start + s) * 2);
    }
  });
  return out;
};

const wav = (pcm: Buffer): Buffer => {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8);
  h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(RATE, 24); h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
};

// ── The check ───────────────────────────────────────────────────────────────
/** Seconds with sound in a file, via afconvert back to PCM (the same decoder WebKit uses on the phone). */
const loudSeconds = (m4a: string): { loud: number[]; total: number } => {
  const tmp = m4a.replace(/\.m4a$/, ".check.wav");
  execFileSync("afconvert", ["-f", "WAVE", "-d", "LEI16@24000", m4a, tmp]);
  const b = readFileSync(tmp);
  execFileSync("rm", [tmp]);
  const pcm = b.subarray(44);
  const total = Math.floor(pcm.length / 2 / RATE);
  const loud: number[] = [];
  for (let sec = 0; sec < total; sec++) {
    let peak = 0;
    for (let s = sec * RATE; s < (sec + 1) * RATE; s += 4) peak = Math.max(peak, Math.abs(pcm.readInt16LE(s * 2)));
    if (peak > 32768 * 0.02) loud.push(sec);
  }
  return { loud, total };
};

const check = (routineId: string): boolean => {
  const file = join(OUT_DIR, `${voiceFile(routineId)}.m4a`);
  if (!existsSync(file)) { console.error(`✗ ${routineId}: ${file} missing`); return false; }
  const { lines, totalSec } = scriptFor(routineId);
  const { loud, total } = loudSeconds(file);
  const spoken = new Set(loud);
  const hit = lines.filter((l) => spoken.has(Math.floor(l.at)) || spoken.has(Math.floor(l.at) + 1)).length;
  const ok = Math.abs(total - totalSec) <= 1 && hit >= Math.ceil(lines.length * 0.9) && loud.length >= lines.length;
  console.log(`${ok ? "✓" : "✗"} ${routineId.padEnd(24)} ${total}s  ${lines.length} lines, ${hit} heard at their second, ${loud.length} loud seconds`);
  return ok;
};

// ── Main ────────────────────────────────────────────────────────────────────
const main = async () => {
  const ids = [...VOICED_ROUTINES].filter((id) => !ONLY || id === ONLY);
  if (!CHECK_ONLY) {
    mkdirSync(OUT_DIR, { recursive: true });
    for (const id of ids) {
      // The breathing scripts schedule the pacer around the spoken length of
      // their instructions, so those are fetched (and cached) before the
      // schedule is built.
      for (const l of scriptFor(id).lines) if (l.at === 0) await tts(l.text);
      const { lines, totalSec } = scriptFor(id);
      console.log(`${id}: ${lines.length} lines over ${totalSec}s`);
      const segments: Buffer[] = [];
      for (const l of lines) segments.push(await tts(l.text));
      const pcm = assemble(lines, segments, totalSec, id);
      const wavPath = join(CACHE_DIR, `${voiceFile(id)}.wav`);
      writeFileSync(wavPath, wav(pcm));
      const out = join(OUT_DIR, `${voiceFile(id)}.m4a`);
      execFileSync("afconvert", ["-f", "m4af", "-d", "aac", "-b", "32000", "-c", "1", wavPath, out]);
    }
  }
  const results = ids.map(check);
  if (results.some((r) => !r)) { console.error("voice check failed"); process.exit(1); }
};

void main();
