// Returns the URL only if it's a real http(s) link, else undefined. Guards
// href={userSuppliedUrl} against javascript:/data: injection — validation at
// WRITE time (a form regex) can be bypassed by anyone hitting the RPC/table
// directly, so links must be re-validated at RENDER time.
export function safeHttpUrl(u: string | null | undefined): string | undefined {
  if (!u) return undefined;
  try {
    const parsed = new URL(u);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}
