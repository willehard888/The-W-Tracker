import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Internal-only: the waitlist AFTER INSERT trigger invokes this with the
// service-role key (same pattern as notify-referral).
function isServiceRole(token: string, envKey: string): boolean {
  if (!token) return false;
  if (envKey && token === envKey) return true;
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

// Mirrors the quiz success-card personalization (public/waitlist.html).
const GOAL_LINES: Record<string, string> = {
  muscle: "Your muscle-building plan is waiting.",
  fat: "Your fat-loss plan is waiting.",
  energy: "Your energy plan is waiting.",
  discipline: "Your Discipline plan is waiting.",
  sleep: "Your recovery plan is waiting.",
  mental: "Your mental-strength plan is waiting.",
};

const GOLD = "#e0aa3e";

function welcomeHtml(goalLine: string | null): string {
  // Table-based, inline-styled — the only layout language every email client
  // (Gmail, Outlook, Apple Mail dark mode) renders faithfully.
  return `<!doctype html>
<html><body style="margin:0;padding:0;background-color:#0c0a10;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0c0a10;">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
  <tr><td align="center" style="padding-bottom:28px;">
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:bold;color:${GOLD};letter-spacing:-0.5px;">Whealth Factory</div>
  </td></tr>
  <tr><td style="background-color:#131017;border:1px solid #2b2436;border-radius:16px;padding:36px 32px;">
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;color:${GOLD};letter-spacing:2px;text-transform:uppercase;padding-bottom:14px;">Discipline is the new flex</div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:30px;font-weight:800;color:#f2f0ec;letter-spacing:-0.5px;line-height:1.1;padding-bottom:14px;">You&rsquo;re in. 🔥</div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#b9b4ac;line-height:1.6;padding-bottom:8px;">
      Your spot on the Whealth Factory waitlist is locked.
      ${goalLine ? `<span style="color:#f2f0ec;font-weight:bold;">${goalLine}</span>` : ""}
    </div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#b9b4ac;line-height:1.6;padding-bottom:24px;">
      Turn self-improvement into a visible status game: track your discipline, compete with others, earn your Status.
    </div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;color:${GOLD};letter-spacing:1.5px;text-transform:uppercase;padding-bottom:10px;">What happens next</div>
    <table role="presentation" cellpadding="0" cellspacing="0" style="padding-bottom:8px;">
      <tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#b9b4ac;line-height:1.8;">
        1&nbsp;&nbsp;We open the doors in waves — the waitlist gets in first.<br/>
        2&nbsp;&nbsp;Your invite lands in this inbox. Watch for it.<br/>
        3&nbsp;&nbsp;Day one, your streak starts. Elite doesn&rsquo;t skip days.
      </td></tr>
    </table>
  </td></tr>
  <tr><td align="center" style="padding-top:28px;">
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:bold;color:#6f6a63;letter-spacing:2px;text-transform:uppercase;">✦ Earn your status ✦</div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#55504a;padding-top:10px;">You received this because you joined the waitlist at whealthfactory.com</div>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

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

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
  if (!RESEND_API_KEY) {
    // Safe rollout: the trigger fires from day one, sending starts the moment
    // the founder sets the secret. Never an error the DB would care about.
    return new Response(JSON.stringify({ skipped: "RESEND_API_KEY not set" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { email, answers } = await req.json();
    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "email required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const goals: string[] = Array.isArray(answers?.goals) ? answers.goals : [];
    const goalLine = goals.map((g) => GOAL_LINES[g]).find(Boolean) ?? null;

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Whealth Factory <hello@whealthfactory.com>",
        to: [email],
        subject: "You're on the list 🔥",
        html: welcomeHtml(goalLine),
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      console.error("resend failed:", resp.status, detail.slice(0, 300));
      return new Response(JSON.stringify({ error: "send failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, serviceKey);
    await supabase
      .from("waitlist")
      .update({ welcomed_at: new Date().toISOString() })
      .eq("email", email.toLowerCase());

    return new Response(JSON.stringify({ sent: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("waitlist-welcome:", e);
    return new Response(JSON.stringify({ error: "internal" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
