import { Home, Target, Trophy, User, Swords, Flame, MessageCircle } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const tabs = [
  { icon: Home, label: "Home", path: "/", color: "text-gold" },
  { icon: Target, label: "Check-in", path: "/checkin", color: "text-[hsl(var(--teal))]" },
  { icon: Flame, label: "Feed", path: "/feed", color: "text-[hsl(var(--streak-orange))]" },
  { icon: MessageCircle, label: "DMs", path: "/messages", color: "text-[hsl(var(--purple))]" },
  { icon: Trophy, label: "Ranks", path: "/leaderboard", color: "text-gold" },
  { icon: Swords, label: "Battles", path: "/battles", color: "text-[hsl(var(--rose))]" },
  { icon: User, label: "Profile", path: "/profile", color: "text-gold" },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  if (["/landing", "/auth"].includes(location.pathname)) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md shadow-[0_-4px_24px_hsl(0_0%_0%/0.4),0_-1px_6px_hsl(270_60%_58%/0.06)]" style={{ borderImage: "linear-gradient(90deg, hsl(270 60% 58% / 0.2), hsl(42 78% 54% / 0.3), hsl(270 60% 58% / 0.2)) 1" }}>
      <div className="max-w-md mx-auto flex items-center justify-around px-1 py-1.5">
        {tabs.map(({ icon: Icon, label, path, color }) => {
          const active = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={cn(
                "relative flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-all duration-200 active:scale-95",
                active ? color : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon size={18} strokeWidth={active ? 2.5 : 1.8} />
              <span className="text-[9px] font-medium tracking-wide">{label}</span>
              {active && (
                <div className={cn(
                  "absolute -top-0.5 w-6 h-0.5 rounded-full",
                  color === "text-gold" && "bg-gold glow-gold-sm",
                  color === "text-[hsl(var(--teal))]" && "bg-[hsl(var(--teal))] glow-teal-sm",
                  color === "text-[hsl(var(--streak-orange))]" && "bg-[hsl(var(--streak-orange))]",
                  color === "text-[hsl(var(--purple))]" && "bg-[hsl(var(--purple))] glow-purple-sm",
                  color === "text-[hsl(var(--rose))]" && "bg-[hsl(var(--rose))] glow-rose-sm",
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
