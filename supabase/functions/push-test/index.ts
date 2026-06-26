// TEMPORARY diagnostic — sends a test push to ONE user (default: willehard) so we
// can confirm APNs auth + delivery without spamming everyone. Safe to delete.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendApnsBatch, sendApnsPush } from "../_shared/apns.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o, null, 2), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  // Locked to a single account — never pushes to arbitrary users.
  const username = "willehard";

  const { data: prof } = await sb.from("profiles").select("user_id").ilike("username", username).maybeSingle();
  if (!prof) return json({ error: "user_not_found", username }, 404);

  const { data: tokens } = await sb.from("push_tokens").select("token, platform").eq("user_id", prof.user_id);

  if (!tokens || tokens.length === 0) {
    // No registered device — probe APNs AUTH only with a dummy token.
    try {
      const r = await sendApnsPush("0".repeat(64), { title: "probe", body: "probe" });
      const authOk = r.reason === "BadDeviceToken" || r.reason === "DeviceTokenNotForTopic" || r.status === 200;
      return json({
        mode: "auth_probe",
        note: "No push tokens registered for this user. Open the app on your iPhone and allow notifications, then run again for a real delivery test.",
        apns_auth_ok: authOk,
        verdict: authOk
          ? "✅ APNs key is VALID (Apple accepted the token, just no real device registered)."
          : "❌ APNs key REJECTED — wrong key (not APNs-enabled) or wrong Team/Bundle id.",
        result: r,
      });
    } catch (e) {
      return json({ mode: "auth_probe", error: "apns_threw", detail: e instanceof Error ? e.message : String(e) });
    }
  }

  let results;
  try {
    results = await sendApnsBatch(tokens, {
      title: "Push works ✅",
      body: "Notifications are live — streak reminders & coach nudges are on.",
      data: { route: "/" },
    });
  } catch (e) {
    return json({ error: "apns_threw", detail: e instanceof Error ? e.message : String(e) });
  }
  const sent = results.filter((r) => r.status === 200).length;
  return json({
    mode: "real_send",
    username,
    tokens: tokens.length,
    sent,
    verdict: sent > 0 ? "✅ Delivered — check the device." : "⚠️ Not delivered — see reasons below.",
    results,
  });
});
