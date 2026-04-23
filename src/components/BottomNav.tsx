import { Home, Target, Trophy, User, Swords, Flame, MessageCircle, Users } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { memo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { hapticImpact } from "@/lib/haptics";

const tabs = [
  { icon: Home, label: "Home", path: "/", color: "gold" },
  { icon: Target, label: "Check-in", path: "/checkin", color: "teal" },
  { icon: Flame, label: "Feed", path: "/feed", color: "orange" },
  { icon: Users, label: "Tribes", path: "/tribes", color: "apex" },
  { icon: MessageCircle, label: "DMs", path: "/messages", color: "purple" },
  { icon: Trophy, label: "Ranks", path: "/leaderboard", color: "gold" },
  { icon: Swords, label: "Battles", path: "/battles", color: "rose" },
  { icon: User, label: "Profile", path: "/profile", color: "gold" },
] as const;

type TabColor = typeof tabs[number]["color"];

const colorMap: Record<TabColor, { text: string; rgb: string }> = {
  gold: { text: "text-gold", rgb: "var(--gold)" },
  teal: { text: "text-[hsl(var(--teal))]", rgb: "var(--teal)" },
  orange: { text: "text-[hsl(var(--streak-orange))]", rgb: "var(--streak-orange)" },
  purple: { text: "text-[hsl(var(--purple))]", rgb: "var(--purple)" },
  rose: { text: "text-[hsl(var(--rose))]", rgb: "var(--rose)" },
  apex: { text: "text-[hsl(18_95%_58%)]", rgb: "18 95% 58%" },
};

const HIDDEN_PATHS = new Set(["/landing", "/auth", "/onboarding", "/paywall"]);

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleNav = useCallback(
    (path: string) => {
      if (location.pathname === path) return;
      hapticImpact("light");
      navigate(path);
    },
    [location.pathname, navigate],
  );

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
            "linear-gradient(180deg, hsl(var(--background) / 0.55) 0%, hsl(var(--background) / 0.92) 60%, hsl(var(--background)) 100%)",
          backdropFilter: "blur(18px) saturate(1.2)",
          WebkitBackdropFilter: "blur(18px) saturate(1.2)",
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
          const active = location.pathname === path;
          const c = colorMap[color];
          const colorVar = c.rgb.startsWith("var(") ? `hsl(${c.rgb})` : `hsl(${c.rgb})`;

          return (
            <button
              key={path}
              type="button"
              aria-label={label}
              aria-current={active ? "page" : undefined}
              onClick={() => handleNav(path)}
              className={cn(
                "group relative flex flex-col items-center justify-center gap-0.5 px-1.5 py-1.5 rounded-xl",
                "transition-transform duration-150 will-change-transform",
                "active:scale-[0.94]",
                active ? c.text : "text-muted-foreground/55",
              )}
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              {/* Active pill — sits behind the icon, no animated shadows */}
              {active && (
                <span
                  aria-hidden
                  className="absolute inset-x-1 top-0.5 bottom-1.5 rounded-xl pointer-events-none"
                  style={{
                    background: `linear-gradient(180deg, ${colorVar.replace(")", " / 0.14)")}, ${colorVar.replace(")", " / 0.04)")})`,
                    border: `1px solid ${colorVar.replace(")", " / 0.22)")}`,
                  }}
                />
              )}

              <span className="relative flex items-center justify-center h-6 w-6">
                <Icon
                  size={20}
                  strokeWidth={active ? 2.5 : 1.75}
                  className="relative z-10"
                  style={
                    active
                      ? { filter: `drop-shadow(0 0 3px ${colorVar.replace(")", " / 0.7)")})` }
                      : undefined
                  }
                />
              </span>

              <span
                className={cn(
                  "relative text-[9.5px] font-bold tracking-wide leading-none",
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
                    boxShadow: `0 0 6px ${colorVar.replace(")", " / 0.6)")}`,
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
