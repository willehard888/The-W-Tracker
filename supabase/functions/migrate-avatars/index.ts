// One-shot migration: move avatar objects out of proof-photos into the
// dedicated public `avatars` bucket and rewrite profiles.avatar_url.
// Run BEFORE proof-photos flips private — after the flip, the old
// object/public URLs 404 for everyone (including /u/:username anons).
//
// Service-role only. Idempotent: rows already pointing at /avatars/ are
// skipped; storage upload uses upsert.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function isServiceRole(token: string): boolean {
  if (!token) return false;
  if (token === SERVICE_KEY) return true;
  try {
    const seg = token.split(".")[1];
    if (!seg) return false;
    const b64 = seg.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64.length % 4 ? b64 + "=".repeat(4 - (b64.length % 4)) : b64;
    return JSON.parse(atob(padded))?.role === "service_role";
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!isServiceRole(token)) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: rows, error } = await admin
    .from("profiles")
    .select("user_id, avatar_url")
    .like("avatar_url", "%/proof-photos/%");
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  let migrated = 0;
  const failures: string[] = [];

  for (const row of rows ?? []) {
    try {
      const key = String(row.avatar_url).split("/proof-photos/")[1]?.split("?")[0];
      if (!key) { failures.push(`${row.user_id}: no key`); continue; }

      const { data: blob, error: dlErr } = await admin.storage.from("proof-photos").download(key);
      if (dlErr || !blob) { failures.push(`${row.user_id}: download ${dlErr?.message}`); continue; }

      const { error: upErr } = await admin.storage.from("avatars").upload(key, blob, {
        upsert: true,
        contentType: blob.type || "image/jpeg",
      });
      if (upErr) { failures.push(`${row.user_id}: upload ${upErr.message}`); continue; }

      const { data: pub } = admin.storage.from("avatars").getPublicUrl(key);
      const { error: updErr } = await admin
        .from("profiles")
        .update({ avatar_url: pub.publicUrl })
        .eq("user_id", row.user_id);
      if (updErr) { failures.push(`${row.user_id}: profile ${updErr.message}`); continue; }

      migrated++;
    } catch (e) {
      failures.push(`${row.user_id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return new Response(
    JSON.stringify({ candidates: rows?.length ?? 0, migrated, failures }),
    { headers: { "Content-Type": "application/json" } },
  );
});
