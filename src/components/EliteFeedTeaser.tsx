import { useNavigate } from "react-router-dom";
import { Crown, Lock, Flame, Trophy, Swords, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { getTierConfig } from "@/lib/status-tiers";
import RoadToElite from "@/components/RoadToElite";

const FAKE_POSTS = [
  { username: "••••••", content: "Just hit a 30-day streak 🔥 Cold showers every morning...", likes: 47, comments: 12 },
  { username: "••••••", content: "5AM workout done. No excuses. This is the way.", likes: 89, comments: 23 },
  { username: "••••••", content: "Level 15 unlocked! The grind never stops 💪", likes: 156, comments: 41 },
  { username: "••••••", content: "New personal record — 200 XP in one day", likes: 63, comments: 8 },
  { username: "••••••", content: "Elite badge earned. Who else is in the top 1%?", likes: 211, comments: 55 },
];

/**
 * Shown when a member is viewing the Elite Feed but has NOT earned
 * Elite status_tier yet. Posting requires earning Elite — not paying.
 */
const EliteFeedTeaser = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const tierRank = getTierConfig(profile?.status_tier ?? "recruit").rank;
  const isEarnedElite = tierRank >= 4;

  return (
    <div className="min-h-screen pb-24 px-4 pt-6 safe-top">
      {/* Header */}
      <div className="animate-reveal mb-6">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg gradient-gold flex items-center justify-center">
            <Flame size={16} className="text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight leading-none my-[10px] py-[10px]">Elite Feed</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Discipline proof from top performers</p>
          </div>
        </div>
      </div>

      {/* Live Road to Elite progress */}
      {!isEarnedElite && <div className="mb-5"><RoadToElite /></div>}

      {/* Blurred fake posts */}
      <div className="relative">
        <div className="space-y-4">
          {FAKE_POSTS.map((post, i) => (
            <div
              key={i}
              className={cn(
                "rounded-xl border border-border bg-card p-4 transition-all",
                i < 2 ? "blur-[6px]" : "blur-[10px]",
                "select-none pointer-events-none"
              )}
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-full bg-secondary" />
                <div>
                  <p className="text-sm font-bold">{post.username}</p>
                  <p className="text-[10px] text-muted-foreground">2h ago</p>
                </div>
              </div>
              <p className="text-sm mb-3">{post.content}</p>
              {i % 2 === 0 && (
                <div className="w-full h-48 rounded-lg bg-secondary/50 mb-3" />
              )}
              <div className="flex items-center gap-4 text-muted-foreground text-xs">
                <span>🔥 {post.likes}</span>
                <span>💬 {post.comments}</span>
                <span>🏆 {Math.floor(post.likes / 5)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Overlay CTA */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-full max-w-sm mx-auto">
            <div className="rounded-2xl glass-card-gold p-6 text-center gradient-border-animated shimmer-overlay mx-4">
              <div className="h-16 w-16 mx-auto rounded-full gradient-gold flex items-center justify-center glow-gold mb-4">
                <Lock size={28} className="text-primary-foreground" />
              </div>
              <h2 className="font-display text-xl font-black tracking-tight mb-2">
                <span className="text-gold glow-gold-text">Earn Your Elite</span>
              </h2>
              <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                Posting on the Elite Feed is reserved for the Top 5% — it's earned, not bought. Keep your streak alive and stay consistent.
              </p>

              {/* What Elite unlocks */}
              <div className="space-y-2 mb-6 text-left">
                {[
                  { icon: Flame, text: "Post your wins & proof" },
                  { icon: Trophy, text: "Give & receive Kudos" },
                  { icon: Swords, text: "Earn the gold Elite tier badge" },
                  { icon: Zap, text: "Visible status across the app" },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-2.5">
                    <div className="h-6 w-6 rounded-md bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                      <Icon size={12} className="text-gold" />
                    </div>
                    <span className="text-xs font-medium text-foreground/80">{text}</span>
                  </div>
                ))}
              </div>

              <Button
                variant="ember"
                size="xl"
                className="w-full breathing-glow"
                onClick={() => navigate("/profile")}
              >
                <Crown size={18} />
                Track Your Progress
              </Button>

              <p className="text-[10px] text-muted-foreground mt-3 tracking-wider uppercase">
                Top 5% • 14 active days • 30-day streak
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EliteFeedTeaser;
