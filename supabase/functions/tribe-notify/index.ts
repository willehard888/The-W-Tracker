import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendApnsBatch } from "../_shared/apns.ts";
import { getPushTargets } from "../_shared/push-targets.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Internal-only: DB triggers invoke this with the service-role key.
function isServiceRole(token: string, envKey: string): boolean {
  if (!token) return false;
  // Exact service-role key match only. The previous fallback decoded the JWT
  // payload WITHOUT verifying its signature, so any forged token claiming
  // role=service_role passed — a full auth bypass the moment one of these
  // functions ever gets verify_jwt=false in config.toml.
  return !!envKey && token === envKey;
}

const TIER_NAMES = ["Hot", "Blaze", "Inferno", "Nova", "Diamond", "Legendary", "Firestorm"];

type Push = { title: string; body: string; route: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!isServiceRole(token, serviceKey)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, serviceKey);

  const activeMembers = async (tribeId: string): Promise<string[]> => {
    const { data } = await supabase
      .from("tribe_members").select("user_id")
      .eq("tribe_id", tribeId).eq("status", "active");
    return ((data ?? []) as { user_id: string }[]).map((r) => r.user_id);
  };
  const tribeName = async (tribeId: string): Promise<string> => {
    const { data } = await supabase.from("tribes").select("name").eq("id", tribeId).maybeSingle();
    return (data as { name?: string } | null)?.name ?? "your tribe";
  };

  try {
    const { kind, ...p } = await req.json();

    // recipients → one push each; duplicates removed.
    let recipients: string[] = [];
    let push: Push | null = null;

    if (kind === "battle_challenge" && p.battle_id) {
      const { data: b } = await supabase
        .from("tribe_battles")
        .select("opponent_owner_id, challenger_tribe_id, opponent_tribe_id, duration_days")
        .eq("id", p.battle_id).maybeSingle();
      if (b) {
        const challenger = await tribeName((b as any).challenger_tribe_id);
        recipients = [(b as any).opponent_owner_id];
        push = {
          title: "Battle challenge ⚔️",
          body: `${challenger} challenged your tribe to a ${(b as any).duration_days}-day battle. Accept?`,
          route: `/tribes/${(b as any).opponent_tribe_id}/battles`,
        };
      }
    } else if (kind === "battle_resolved" && p.battle_id) {
      const { data: b } = await supabase
        .from("tribe_battles")
        .select("challenger_tribe_id, opponent_tribe_id, winner_tribe_id, challenger_score, opponent_score")
        .eq("id", p.battle_id).maybeSingle();
      if (b) {
        const w = (b as any).winner_tribe_id as string | null;
        const [cName, oName] = await Promise.all([
          tribeName((b as any).challenger_tribe_id),
          tribeName((b as any).opponent_tribe_id),
        ]);
        const score = `${(b as any).challenger_score}–${(b as any).opponent_score}`;
        const members = (await Promise.all([
          activeMembers((b as any).challenger_tribe_id),
          activeMembers((b as any).opponent_tribe_id),
        ])).flat();
        recipients = members;
        push = {
          title: w ? "Battle decided ⚔️" : "Battle ends in a draw",
          body: w
            ? `${w === (b as any).challenger_tribe_id ? cName : oName} takes it ${score}. Winners earn +50 XP.`
            : `${cName} vs ${oName} ends ${score}.`,
          route: `/tribes/${(b as any).challenger_tribe_id}/battles`,
        };
      }
    } else if (kind === "invite" && p.invite_id) {
      const { data: inv } = await supabase
        .from("tribe_invites").select("invitee_id, tribe_id, inviter_id")
        .eq("id", p.invite_id).maybeSingle();
      if (inv) {
        const [name, { data: inviter }] = await Promise.all([
          tribeName((inv as any).tribe_id),
          supabase.from("profiles").select("username").eq("user_id", (inv as any).inviter_id).maybeSingle(),
        ]);
        recipients = [(inv as any).invitee_id];
        push = {
          title: "Tribe invite 🤝",
          body: `@${(inviter as any)?.username ?? "someone"} invited you to join ${name}.`,
          route: "/squad?tab=tribes",
        };
      }
    } else if (kind === "milestone" && p.milestone_id) {
      const { data: ms } = await supabase
        .from("tribe_milestones").select("tribe_id, kind, payload")
        .eq("id", p.milestone_id).maybeSingle();
      if (ms && ((ms as any).kind === "tier_up" || (ms as any).kind === "challenge_done")) {
        const name = await tribeName((ms as any).tribe_id);
        recipients = await activeMembers((ms as any).tribe_id);
        const pay = (ms as any).payload ?? {};
        push = (ms as any).kind === "tier_up"
          ? {
              title: `${name} tiered up 🔥`,
              body: `The collective fire hit ${TIER_NAMES[Number(pay.tier)] ?? "a new tier"} — ${pay.streak ?? "?"} combined days.`,
              route: `/tribes/${(ms as any).tribe_id}`,
            }
          : {
              title: `${name} crushed the weekly goal 🏆`,
              body: `${pay.target ?? "?"} check-ins together. +25 XP each — claimed.`,
              route: `/tribes/${(ms as any).tribe_id}`,
            };
      }
    }

    if (!push || recipients.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const uniq = Array.from(new Set(recipients));

    // In-app inbox rows — one per recipient. The tribe-invite ledger row is
    // written by its DB trigger (tribe_invites_ledger), so skip it here to
    // avoid doubles.
    if (kind !== "invite") {
      await supabase.from("notifications").insert(uniq.map((uid) => ({
        user_id: uid,
        kind: `tribe_${kind}`,
        title: push!.title,
        body: push!.body,
        route: push!.route,
      })));
    }

    const tokens = await getPushTargets(supabase, uniq, "tribe");

    let sent = 0;
    if (tokens.length > 0) {
      const results = await sendApnsBatch(tokens, {
        title: push.title,
        body: push.body,
        data: { route: push.route },
        threadId: "tribe",
      });
      sent = results.filter((r) => r.status === 200).length;
      const dead = results
        .filter((r) => r.reason === "BadDeviceToken" || r.reason === "Unregistered")
        .map((r) => r.token);
      if (dead.length) await supabase.from("push_tokens").delete().in("token", dead);
    }

    return new Response(JSON.stringify({ ok: true, sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("tribe-notify error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
