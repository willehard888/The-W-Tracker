// Bot-friendly HTML page for /u/:username — returns rich OG/Twitter metatags.
// Crawlers (Twitter, Facebook, Discord, Slack, iMessage, LinkedIn) get full meta.
// Real browsers get redirected to the SPA route /u/:username.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const APP_ORIGIN = Deno.env.get("APP_ORIGIN") ?? "https://status-level-up.lovable.app";
const FN_BASE = `${SUPABASE_URL}/functions/v1`;

const TIER_LABEL: Record<string, { label: string; emoji: string; pct: string }> = {
  recruit:        { label: "Recruit",        emoji: "⬛", pct: "Bottom 50%" },
  normal:         { label: "Recruit",        emoji: "⬛", pct: "Bottom 50%" },
  operator:       { label: "Operator",       emoji: "🟢", pct: "Top 50%" },
  performer:      { label: "Performer",      emoji: "🔵", pct: "Top 25%" },
  high_performer: { label: "High Performer", emoji: "🟣", pct: "Top 10%" },
  elite:          { label: "Elite",          emoji: "👑", pct: "Top 5%" },
  apex:           { label: "Apex",           emoji: "⚡", pct: "Top 1%" },
  legend:         { label: "Legend",         emoji: "🔱", pct: "Top 0.1%" },
};

const esc = (s: string) =>
  s.replace(/[<>&'"]/g, (c) => ({ "<":"&lt;",">":"&gt;","&":"&amp;","'":"&#39;","\"":"&quot;" }[c]!));

const BOT_RE = /bot|crawler|spider|facebookexternalhit|twitterbot|slackbot|discordbot|linkedinbot|whatsapp|telegrambot|preview|skype|embedly|pinterest|vkshare|w3c_validator|googlebot|bingbot|duckduckbot|applebot/i;

Deno.serve(async (req) => {
  try {
  const url = new URL(req.url);
  // username can be in path (?path=/u/foo) or query (?u=foo)
  let username = url.searchParams.get("u")?.trim();
  if (!username) {
    const path = url.searchParams.get("path") ?? url.pathname;
    const m = path.match(/\/u\/([^/?#]+)/i);
    if (m) username = decodeURIComponent(m[1]);
  }

  const ua = req.headers.get("user-agent") ?? "";
  const isBot = BOT_RE.test(ua) || url.searchParams.get("debug") === "1";
  const target = username ? `${APP_ORIGIN}/u/${encodeURIComponent(username)}` : APP_ORIGIN;

  // Real users → redirect to SPA
  if (!isBot) {
    return new Response(null, { status: 302, headers: { location: target } });
  }

  if (!username) {
    return new Response(renderHtml({
      title: "The W Tracker",
      desc: "Discipline is the new flex. Track XP, climb tiers, earn status.",
      image: `${FN_BASE}/og-image`,
      url: target,
    }), { headers: { "content-type": "text/html; charset=utf-8" } });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data } = await sb
    .from("profiles")
    .select("username, display_name, xp, level, streak, status_tier, is_elite")
    .ilike("username", username)
    .maybeSingle();

  if (!data) {
    return new Response(renderHtml({
      title: `@${username} · The W Tracker`,
      desc: `User @${username} not found. Claim a status of your own.`,
      image: `${FN_BASE}/og-image?u=${encodeURIComponent(username)}`,
      url: target,
    }), { headers: { "content-type": "text/html; charset=utf-8" } });
  }

  const t = TIER_LABEL[data.status_tier ?? "recruit"] || TIER_LABEL.recruit;
  // EARNED elite crown, not the paid flag.
  const elite = ["elite", "apex", "legend"].includes(data.status_tier ?? "") ? "👑 " : "";
  const title = `@${data.username} · ${t.label} · The W Tracker`;
  const desc = `${elite}${t.emoji} ${t.label} · Level ${data.level} · ${data.streak}d streak · ${(data.xp ?? 0).toLocaleString()} XP · ${t.pct}`;
  const image = `${FN_BASE}/og-image?u=${encodeURIComponent(data.username)}&v=${data.xp}`;

  return new Response(renderHtml({ title, desc, image, url: target }), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=120, s-maxage=120",
    },
  });
  } catch (e) {
    // A DB hiccup must not return a bare 500: social crawlers cache the
    // broken preview for the whole share loop. Serve a branded fallback.
    console.error("og fallback:", e);
    return new Response(
      `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#0a0810"/><text x="600" y="330" text-anchor="middle" font-family="Inter, sans-serif" font-weight="900" font-size="56" fill="#f5b942">Whealth Factory</text></svg>`,
      { headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=60", "access-control-allow-origin": "*" } },
    );
  }
});

function renderHtml(p: { title: string; desc: string; image: string; url: string }) {
  const T = esc(p.title), D = esc(p.desc), I = esc(p.image), U = esc(p.url);
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/>
<title>${T}</title>
<meta name="description" content="${D}"/>
<link rel="canonical" href="${U}"/>
<meta property="og:type" content="profile"/>
<meta property="og:site_name" content="The W Tracker"/>
<meta property="og:title" content="${T}"/>
<meta property="og:description" content="${D}"/>
<meta property="og:url" content="${U}"/>
<meta property="og:image" content="${I}"/>
<meta property="og:image:type" content="image/svg+xml"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${T}"/>
<meta name="twitter:description" content="${D}"/>
<meta name="twitter:image" content="${I}"/>
<meta http-equiv="refresh" content="0; url=${U}"/>
</head><body>
<p>Redirecting to <a href="${U}">${U}</a></p>
</body></html>`;
}
