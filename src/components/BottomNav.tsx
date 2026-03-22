import { Home, Target, Trophy, User, Swords, Flame } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const tabs = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Target, label: "Check-in", path: "/checkin" },
  { icon: Flame, label: "Feed", path: "/feed" },
  { icon: Trophy, label: "Ranks", path: "/leaderboard" },
  { icon: Swords, label: "Battles", path: "/battles" },
  { icon: User, label: "Profile", path: "/profile" },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  if (["/landing", "/auth"].includes(location.pathname)) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md">
      <div className="max-w-md mx-auto flex items-center justify-around px-1 py-1.5">
        {tabs.map(({ icon: Icon, label, path }) => {
          const active = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={cn(
                "relative flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-all duration-200 active:scale-95",
                active ? "text-gold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon size={18} strokeWidth={active ? 2.5 : 1.8} />
              <span className="text-[9px] font-medium tracking-wide">{label}</span>
              {active && (
                <div className="absolute -top-0.5 w-6 h-0.5 rounded-full bg-gold glow-gold-sm" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
