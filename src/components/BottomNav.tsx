import { Home, Trophy, User, Users } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { memo, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { hapticImpact } from "@/lib/haptics";

// Four focused tabs: show up (Today) → belong (Squad: feed/tribes/friends) →
// see where you stand (Ranks) → identity (Profile). Coach (the brain) is
// reached from the Today coach card; Battles/Messages live inside
// Ranks/Squad — no orphan routes, no crowded nav.
const tabs = [
  { icon: Home, label: "Today", path: "/", color: "gold" },
  { icon: Users, label: "Squad", path: "/squad", color: "apex" },
  { icon: Trophy, label: "Ranks", path: "/leaderboard", color: "gold" },
  { icon: User, label: "Profile", path: "/profile", color: "gold" },
] as const;

type TabColor = typeof tabs[number]["color"];

const colorMap: Record<TabColor, { text: string; rgb: string }> = {
  // Unified Gold · Fire/Lava · Black palette — every tab lives in the same
  // warm spectrum. Only the colors the tabs actually use live here (extra
  // keys were a strict-mode type error waiting to bite).
  gold:  { text: "text-[hsl(var(--gold))]",         rgb: "var(--gold)" },
  apex:  { text: "text-[hsl(var(--ember))]",        rgb: "var(--ember)" },
};

const HIDDEN_PATHS = new Set(["/landing", "/auth", "/onboarding", "/paywall", "/choose-username"]);

// Pushed pages highlight their PARENT tab so "where am I" never goes dark —
// with exact matching, /checkin, /feed, /battles etc. lit no tab at all.
const PARENT_TAB: Array<{ prefix: string; tab: string }> = [
  { prefix: "/checkin", tab: "/" },
  { prefix: "/coach", tab: "/" },
  { prefix: "/recipes", tab: "/" },
  { prefix: "/exercises", tab: "/" },
  { prefix: "/vault", tab: "/" },
  { prefix: "/feed", tab: "/squad" },
  { prefix: "/tribes", tab: "/squad" },
  { prefix: "/tribe", tab: "/squad" },
  { prefix: "/friends", tab: "/squad" },
  { prefix: "/messages", tab: "/squad" },
  { prefix: "/battles", tab: "/leaderboard" },
  { prefix: "/journey", tab: "/profile" },
  { prefix: "/notifications", tab: "/" },
];

const activeTabFor = (pathname: string): string => {
  const hit = PARENT_TAB.find((m) => pathname === m.prefix || pathname.startsWith(m.prefix + "/") || pathname.startsWith(m.prefix + "-"));
  return hit ? hit.tab : pathname;
};

// Lazy-route prefetch map — kick off import() on hover/focus of a BottomNav
// button so the destination is nearly loaded by the time the tap lands.
// Mirrors the dynamic imports already declared as lazy routes in App.tsx.
const PREFETCH: Record<string, () => Promise<unknown>> = {
  "/checkin": () => import("@/pages/DailyCheckin"),
  "/coach": () => import("@/pages/Coach"),
  "/squad": () => import("@/pages/Squad"),
  "/leaderboard": () => import("@/pages/Leaderboard"),
  "/profile": () => import("@/pages/Profile"),
};
// Note: /coach kept in prefetch — it's reached from the Today coach card.
const prefetched = new Set<string>();
const prefetchRoute = (path: string) => {
  if (prefetched.has(path)) return;
  prefetched.add(path);
  PREFETCH[path]?.().catch(() => prefetched.delete(path));
};

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const pressedAt = useRef<{ path: string; t: number } | null>(null);

  // Fire haptic on pointer-down (16ms before navigation) so feedback feels
  // instant. Navigate on pointer-up only if still on same target — cancels
  // accidental drags / scroll-from-nav.
  const onPointerDown = useCallback((path: string) => {
    if (location.pathname === path) return;
    hapticImpact("light");
    pressedAt.current = { path, t: Date.now() };
    prefetchRoute(path);
  }, [location.pathname]);

  const onPointerUp = useCallback((path: string) => {
    const p = pressedAt.current;
    pressedAt.current = null;
    if (!p || p.path !== path) return;
    if (location.pathname === path) return;
    navigate(path);
  }, [location.pathname, navigate]);

  if (HIDDEN_PATHS.has(location.pathname) || location.pathname.startsWith("/chat/")) {
    return null;
  }

  return (
    <nav
      aria-label="Primary"
      className="shrink-0 relative isolate"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        contain: "layout paint",
      }}
    >
      {/* Layered surface — frost + warm under-glow + hairline */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, hsl(var(--background) / 0.88) 0%, hsl(var(--card) / 0.96) 56%, hsl(var(--background)) 100%)",
          boxShadow:
            "0 -10px 28px hsl(0 0% 0% / 0.22), inset 0 1px 0 hsl(0 0% 100% / 0.05)",
        }}
      />
      <div
        aria-hidden
        className="absolute top-0 left-0 right-0 h-px pointer-events-none opacity-50"
        style={{
          background:
            "linear-gradient(90deg, transparent, hsl(var(--gold) / 0.55) 50%, transparent)",
        }}
      />
      <div
        aria-hidden
        className="absolute -top-6 left-1/2 -translate-x-1/2 w-[60%] h-6 pointer-events-none opacity-70"
        style={{
          background:
            "radial-gradient(ellipse 100% 100% at 50% 100%, hsl(28 95% 55% / 0.08), transparent 70%)",
        }}
      />

      <div className="relative max-w-lg mx-auto flex items-center justify-around px-1.5 pt-2 pb-1.5">
        {tabs.map(({ icon: Icon, label, path, color }) => {
          const active = activeTabFor(location.pathname) === path;
          const c = colorMap[color];
          const colorVar = `hsl(${c.rgb})`;

          return (
            <button
              key={path}
              type="button"
              aria-label={label}
              aria-current={active ? "page" : undefined}
              onPointerDown={() => onPointerDown(path)}
              onPointerUp={() => onPointerUp(path)}
              onPointerCancel={() => { pressedAt.current = null; }}
              onPointerLeave={() => { pressedAt.current = null; }}
              onPointerEnter={() => prefetchRoute(path)}
              onFocus={() => prefetchRoute(path)}
              className={cn(
                "group relative flex flex-col items-center justify-center gap-0.5 px-1.5 py-1.5 rounded-xl",
                "transition-[transform,color,opacity] duration-150 will-change-transform",
                "[transition-timing-function:cubic-bezier(0.16,1.2,0.32,1)]",
                "active:scale-[0.92]",
                active ? c.text : "text-muted-foreground/55",
              )}
              style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
            >
              {/* Active pill — animates between tabs via shared layoutId */}
              {active && (
                <motion.span
                  layoutId="bottom-nav-pill"
                  aria-hidden
                  className="absolute inset-x-1 top-0.5 bottom-1.5 rounded-xl pointer-events-none"
                  style={{
                    background: `linear-gradient(180deg, ${colorVar.replace(")", " / 0.14)")}, ${colorVar.replace(")", " / 0.04)")})`,
                    border: `1px solid ${colorVar.replace(")", " / 0.22)")}`,
                  }}
                  transition={{ type: "spring", stiffness: 380, damping: 34 }}
                />
              )}

              <span className="relative flex items-center justify-center h-6 w-6">
                <Icon
                  size={20}
                  strokeWidth={active ? 2.5 : 1.75}
                  className="relative z-10"
                  style={active ? { opacity: 1 } : undefined}
                />
              </span>

              <span
                className={cn(
                  "relative text-[10px] font-bold tracking-wide leading-none",
                  active ? "opacity-100" : "opacity-65",
                )}
              >
                {label}
              </span>

              {/* Lava underline — static gradient, single subtle pulse */}
              {active && (
                <span
                  aria-hidden
                  className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-[2.5px] w-7 rounded-full overflow-hidden"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${colorVar}, transparent)`,
                    boxShadow: `0 0 4px ${colorVar.replace(")", " / 0.35)")}`,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default memo(BottomNav);
