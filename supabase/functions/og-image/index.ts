// Public OG image generator — returns an SVG portrait card for /u/:username
// SVG is widely supported by Discord, Slack, Twitter, iMessage, LinkedIn previews.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const TIER_THEME: Record<string, { label: string; emoji: string; accent: string; percentile: string }> = {
  recruit:        { label: "RECRUIT",         emoji: "⬛", accent: "#6b7280", percentile: "Bottom 50%" },
  normal:         { label: "RECRUIT",         emoji: "⬛", accent: "#6b7280", percentile: "Bottom 50%" },
  operator:       { label: "OPERATOR",        emoji: "🟢", accent: "#14b8a6", percentile: "Top 50%" },
  performer:      { label: "PERFORMER",       emoji: "🔵", accent: "#3b82f6", percentile: "Top 25%" },
  high_performer: { label: "HIGH PERFORMER",  emoji: "🟣", accent: "#a855f7", percentile: "Top 10%" },
  elite:          { label: "ELITE",           emoji: "👑", accent: "#f5b942", percentile: "Top 5%" },
  apex:           { label: "APEX",            emoji: "⚡", accent: "#fb6a3b", percentile: "Top 1%" },
  legend:         { label: "LEGEND",          emoji: "🔱", accent: "#c084fc", percentile: "Top 0.1%" },
};

const escapeXml = (s: string) =>
  s.replace(/[<>&'"]/g, (c) => ({ "<":"&lt;",">":"&gt;","&":"&amp;","'":"&apos;","\"":"&quot;" }[c]!));

function buildSvg(p: {
  username: string;
  displayName: string | null;
  xp: number;
  level: number;
  streak: number;
  tier: string;
  isElite: boolean;
}) {
  const t = TIER_THEME[p.tier] || TIER_THEME.recruit;
  const xp = p.xp.toLocaleString().replace(/,/g, " ");
  const name = escapeXml(`@${p.username}`);
  const display = p.displayName ? escapeXml(p.displayName) : "";
  const accent = t.accent;
  const elitePill = p.isElite
    ? `<g transform="translate(440 360)">
         <rect rx="22" ry="22" width="120" height="44" fill="${accent}" fill-opacity="0.12" stroke="${accent}" stroke-opacity="0.55"/>
         <text x="60" y="29" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-weight="900" font-size="14" fill="${accent}" letter-spacing="2">👑 ELITE</text>
       </g>` : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="bg" cx="50%" cy="0%" r="120%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.35"/>
      <stop offset="55%" stop-color="#0f0d14" stop-opacity="1"/>
      <stop offset="100%" stop-color="#08070b" stop-opacity="1"/>
    </radialGradient>
    <linearGradient id="hairline" x1="0" x2="1">
      <stop offset="0" stop-color="${accent}" stop-opacity="0"/>
      <stop offset="0.5" stop-color="${accent}" stop-opacity="0.9"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <filter id="goldGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="14" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="60" y="60" width="1080" height="510" rx="36" fill="#0a0810" fill-opacity="0.55" stroke="${accent}" stroke-opacity="0.30"/>
  <line x1="120" y1="60" x2="1080" y2="60" stroke="url(#hairline)" stroke-width="1.5"/>
  <line x1="120" y1="570" x2="1080" y2="570" stroke="url(#hairline)" stroke-width="1"/>

  <!-- Brand -->
  <text x="600" y="135" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-weight="900" font-size="20" fill="${accent}" fill-opacity="0.75" letter-spacing="8">THE W TRACKER</text>

  <!-- Avatar glow + circle -->
  <circle cx="600" cy="245" r="110" fill="url(#glow)"/>
  <circle cx="600" cy="245" r="72" fill="#1a1620" stroke="${accent}" stroke-width="4"/>
  <text x="600" y="270" text-anchor="middle" font-size="64">${t.emoji}</text>

  <!-- Username -->
  <text x="600" y="365" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-weight="900" font-size="56" fill="#f5f0e6" letter-spacing="-1">${name}</text>
  ${display ? `<text x="600" y="398" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-weight="500" font-size="20" fill="#9ca3af">${display}</text>` : ""}

  <!-- Pills row -->
  <g transform="translate(0 ${display ? 420 : 400})">
    <g transform="translate(420 0)">
      <rect rx="22" ry="22" width="160" height="44" fill="${accent}" fill-opacity="0.12" stroke="${accent}" stroke-opacity="0.55"/>
      <text x="80" y="29" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-weight="900" font-size="14" fill="${accent}" letter-spacing="2">${t.label}</text>
    </g>
    <g transform="translate(600 0)">
      <rect rx="22" ry="22" width="180" height="44" fill="#1a1620" stroke="#3a3340"/>
      <text x="90" y="29" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-weight="900" font-size="14" fill="#9ca3af" letter-spacing="2">LEVEL ${p.level}</text>
    </g>
  </g>

  <!-- Massive XP -->
  <text x="600" y="525" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-weight="900" font-size="110" fill="${accent}" letter-spacing="-2" filter="url(#goldGlow)">${xp}</text>
  <text x="600" y="555" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-weight="900" font-size="14" fill="${accent}" fill-opacity="0.7" letter-spacing="8">TOTAL XP · ${p.streak}D STREAK · ${t.percentile.toUpperCase()}</text>

  ${elitePill}
</svg>`;
}

function notFoundSvg(username: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0a0810"/>
  <text x="600" y="300" text-anchor="middle" font-family="Inter, sans-serif" font-weight="900" font-size="48" fill="#f5b942">The W Tracker</text>
  <text x="600" y="360" text-anchor="middle" font-family="Inter, sans-serif" font-weight="700" font-size="24" fill="#9ca3af">@${escapeXml(username)} not found</text>
</svg>`;
}

Deno.serve(async (req) => {
  try {
  const url = new URL(req.url);
  const username = url.searchParams.get("u")?.trim();
  const headers = {
    "content-type": "image/svg+xml; charset=utf-8",
    "cache-control": "public, max-age=300, s-maxage=300",
    "access-control-allow-origin": "*",
  };

  if (!username) {
    return new Response(notFoundSvg("unknown"), { headers });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data } = await sb
    .from("profiles")
    .select("username, display_name, xp, level, streak, status_tier, is_elite")
    .ilike("username", username)
    .maybeSingle();

  if (!data) return new Response(notFoundSvg(username), { headers });

  const svg = buildSvg({
    username: data.username,
    displayName: data.display_name,
    xp: data.xp ?? 0,
    level: data.level ?? 1,
    streak: data.streak ?? 0,
    tier: data.status_tier ?? "recruit",
    // EARNED elite crown on the share card — not the paid flag.
    isElite: ["elite", "apex", "legend"].includes(data.status_tier ?? ""),
  });

  return new Response(svg, { headers });
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
