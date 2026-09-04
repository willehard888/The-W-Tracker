// RFC-4180 CSV parser + cp1252 decoding for the nutrition ingestion scripts.
// No dependencies. Self-check:  npx vite-node scripts/nutrition/csv.mts
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface CsvOptions {
  delimiter?: string;
  quote?: string;
}

/** Quoted fields, doubled quotes, embedded newlines, CRLF, leading BOM. */
export function parseCsv(text: string, { delimiter = ",", quote = '"' }: CsvOptions = {}): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = text.charCodeAt(0) === 0xfeff ? 1 : 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch !== quote) field += ch;
      else if (text[i + 1] === quote) { field += quote; i++; }
      else quoted = false;
      continue;
    }
    if (ch === quote && field === "") { quoted = true; continue; }
    if (ch === delimiter) { row.push(field); field = ""; continue; }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
      continue;
    }
    field += ch;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export const decodeCp1252 = (bytes: Uint8Array): string => new TextDecoder("windows-1252").decode(bytes);

/** "1,5" → 1.5 (Fineli decimal comma); "" → NaN. Plain "1.5" works too. */
export const parseNumber = (s: string): number => (s.trim() === "" ? NaN : Number(s.trim().replace(",", ".")));

export type Rec = Record<string, string>;

export interface ReadCsvOptions extends CsvOptions {
  encoding?: "utf8" | "windows-1252";
  /** Columns to keep; every one must exist in the header (clear error otherwise). Default: all. */
  columns?: string[];
}

/** Header row → array of records. Blank lines are dropped. */
export function readCsvRecords(path: string, opts: ReadCsvOptions = {}): Rec[] {
  const buf = readFileSync(path);
  const text = opts.encoding === "windows-1252" ? decodeCp1252(buf) : buf.toString("utf8");
  const [header, ...body] = parseCsv(text, opts);
  if (!header) throw new Error(`${basename(path)}: empty file`);
  const cols = header.map((h) => h.trim());
  const keep = (opts.columns ?? cols).map((c) => {
    const i = cols.indexOf(c);
    if (i < 0) throw new Error(`${basename(path)}: missing column ${c} (has: ${cols.join(", ")})`);
    return [c, i] as const;
  });
  const out: Rec[] = [];
  for (const r of body) {
    if (r.length === 1 && r[0] === "") continue;
    const rec: Rec = {};
    for (const [c, i] of keep) rec[c] = r[i] ?? "";
    out.push(rec);
  }
  return out;
}

export function runSelfCheck(): void {
  assert.deepEqual(parseCsv('a,"b,c",d'), [["a", "b,c", "d"]], "quoted comma");
  assert.deepEqual(parseCsv('"say ""hi""",x'), [['say "hi"', "x"]], "doubled quote");
  assert.deepEqual(parseCsv("a,b\r\nc,d\r\n"), [["a", "b"], ["c", "d"]], "CRLF + trailing newline");
  assert.deepEqual(parseCsv('"multi\nline",x\ny,'), [["multi\nline", "x"], ["y", ""]], "embedded newline, empty field");
  assert.deepEqual(parseCsv("A;B\n1,5;2,25", { delimiter: ";" }), [["A", "B"], ["1,5", "2,25"]], "';' delimiter, decimal comma untouched");
  assert.deepEqual(parseCsv("\ufeffx,y"), [["x", "y"]], "BOM stripped");
  assert.equal(parseNumber("1,5"), 1.5);
  assert.ok(Number.isNaN(parseNumber(" ")));
  assert.equal(decodeCp1252(new Uint8Array([0xe4, 0xf6, 0xc5])), "äöÅ");
  console.log("csv.mts self-check: OK");
}

// Entry detection: node / `vite-node --script` put the file in argv[1]; plain `vite-node file`
// hides it (argv = [node, vite-node, ...flags]) — then "no flags" means this file was the entry.
const entry = process.argv[1] ?? "";
if (resolve(entry) === fileURLToPath(import.meta.url) || (basename(entry).startsWith("vite-node") && process.argv.length === 2)) {
  runSelfCheck();
}
