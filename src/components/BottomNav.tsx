import { Home, Target, Trophy, User, Swords, Flame, MessageCircle, Users } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { hapticImpact } from "@/lib/haptics";
import { useAuth } from "@/contexts/AuthContext";

const baseTabs = [
  { icon: Home, label: "Home", path: "/", color: "gold" },
  { icon: Target, label: "Check-in", path: "/checkin", color: "teal" },
  { icon: Flame, label: "Feed", path: "/feed", color: "orange" },
  { icon: Users, label: "Tribes", path: "/tribes", color: "apex" },
  { icon: MessageCircle, label: "DMs", path: "/messages", color: "purple" },
  { icon: Trophy, label: "Ranks", path: "/leaderboard", color: "gold" },
  { icon: Swords, label: "Battles", path: "/battles", color: "rose" },
  { icon: User, label: "Profile", path: "/profile", color: "gold" },
];

const colorMap: Record<string, { active: string; dot: string; glow: string }> = {
  gold: { active: "text-gold", dot: "bg-gold", glow: "shadow-[0_0_8px_hsl(var(--gold)/0.5)]" },
  teal: { active: "text-[hsl(var(--teal))]", dot: "bg-[hsl(var(--teal))]", glow: "shadow-[0_0_8px_hsl(var(--teal)/0.5)]" },
  orange: { active: "text-[hsl(var(--streak-orange))]", dot: "bg-[hsl(var(--streak-orange))]", glow: "shadow-[0_0_8px_hsl(var(--streak-orange)/0.5)]" },
  purple: { active: "text-[hsl(var(--purple))]", dot: "bg-[hsl(var(--purple))]", glow: "shadow-[0_0_8px_hsl(var(--purple)/0.5)]" },
  rose: { active: "text-[hsl(var(--rose))]", dot: "bg-[hsl(var(--rose))]", glow: "shadow-[0_0_8px_hsl(var(--rose)/0.5)]" },
  apex: { active: "text-[hsl(18_95%_58%)]", dot: "bg-[hsl(18_95%_58%)]", glow: "shadow-[0_0_8px_hsl(18_95%_58%/0.6)]" },
};

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isElite } = useAuth();

  if (["/landing", "/auth", "/onboarding"].includes(location.pathname) || location.pathname.startsWith("/chat/")) return null;

  const tabs = baseTabs;

  return (
    <nav
      className="shrink-0 surface-glass relative border-x-0 border-b-0 rounded-none"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {/* Hairline top divider */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, hsl(var(--border) / 0.55) 35%, hsl(var(--border) / 0.55) 65%, transparent 100%)",
        }}
      />
      <div className="max-w-md mx-auto flex items-center justify-around px-1 py-2 relative">
        {tabs.map(({ icon: Icon, label, path, color }) => {
          const active = location.pathname === path;
          const colors = colorMap[color];
          return (
            <button
              key={path}
              onClick={() => { hapticImpact("light"); navigate(path); }}
              className={cn(
                "relative flex flex-col items-center gap-1 px-2.5 py-1.5 rounded-xl transition-transform duration-200 [transition-timing-function:var(--ease-spring)] active:scale-[0.96]",
                active
                  ? colors.active
                  : "text-muted-foreground/60 hover:text-muted-foreground"
              )}
            >
              <div className="relative">
                <Icon
                  size={20}
                  strokeWidth={active ? 2.5 : 1.6}
                  className={cn(
                    "transition-all duration-300",
                    active && "drop-shadow-[0_0_4px_currentColor]"
                  )}
                />
              </div>
              <span className={cn(
                "text-[9px] font-bold tracking-wide transition-opacity duration-300",
                active ? "opacity-100" : "opacity-60"
              )}>
                {label}
              </span>
              {active && (
                <div className={cn(
                  "absolute -bottom-1.5 w-5 h-[3px] rounded-full transition-all duration-300",
                  colors.dot,
                  colors.glow
                )} />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
