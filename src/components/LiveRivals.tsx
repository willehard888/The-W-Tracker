import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUp, ArrowDown, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import StatusAvatar from "@/components/StatusAvatar";
import TierUsername from "@/components/TierUsername";
import { useLiveRivals } from "@/hooks/use-live-rivals";

interface LiveRivalsProps {
  userId: string;
  myScore: number;
  className?: string;
}

const LiveRivals = ({ userId, myScore, className }: LiveRivalsProps) => {
  const navigate = useNavigate();
  const { data, isLoading } = useLiveRivals(userId, myScore);

  if (isLoading || (!data?.above && !data?.below)) return null;

  const heatBelow = data.below && data.below.delta < 5;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={cn("rounded-2xl glass-card p-4 relative overflow-hidden", className)}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="eyebrow font-display text-muted-foreground">
          Live Rivals
        </p>
        <button
          type="button"
          onClick={() => navigate("/leaderboard")}
          className="text-[11px] text-gold/70 font-bold hover:text-gold transition-colors"
        >
          Leaderboard →
        </button>
      </div>

      <div className="space-y-2">
        {/* Above */}
        {data.above && (
          <button
            type="button"
            onClick={() => navigate(`/user/${data.above!.user_id}`)}
            className="press w-full flex items-center gap-3 surface-card p-2.5 transition-transform"
          >
            <StatusAvatar
              src={data.above.avatar_url}
              name={data.above.username}
              tier={data.above.status_tier}
              size="sm"
            />
            <div className="flex-1 min-w-0 text-left">
              <TierUsername
                as="p"
                username={data.above.username}
                tier={data.above.status_tier}
                className="font-bold text-sm truncate"
              />
              <p className="eyebrow text-muted-foreground">Ahead of you</p>
            </div>
            <div className="flex items-center gap-1 text-xs font-black tabular-nums text-muted-foreground">
              <ArrowUp size={12} className="text-xp-green" />
              {data.above.delta.toFixed(1)} pts
            </div>
          </button>
        )}

        {/* Below */}
        {data.below && (
          <button
            type="button"
            onClick={() => navigate(`/user/${data.below!.user_id}`)}
            className={cn(
              "press w-full flex items-center gap-3 rounded-xl border p-2.5 transition-transform",
              heatBelow
                ? "border-destructive/40 bg-destructive/5 shadow-[0_0_18px_hsl(var(--destructive)/0.2)]"
                : "border-border/40 bg-card/40",
            )}
          >
            <StatusAvatar
              src={data.below.avatar_url}
              name={data.below.username}
              tier={data.below.status_tier}
              size="sm"
            />
            <div className="flex-1 min-w-0 text-left">
              <TierUsername
                as="p"
                username={data.below.username}
                tier={data.below.status_tier}
                className="font-bold text-sm truncate"
              />
              <p
                className={cn(
                  "eyebrow flex items-center gap-1",
                  heatBelow ? "text-destructive font-black" : "text-muted-foreground",
                )}
              >
                {heatBelow ? (
                  <>
                    <Flame size={12} /> Catching up
                  </>
                ) : (
                  "Behind you"
                )}
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs font-black tabular-nums text-muted-foreground">
              <ArrowDown size={12} className={heatBelow ? "text-destructive" : "text-muted-foreground"} />
              {data.below.delta.toFixed(1)} pts
            </div>
          </button>
        )}
      </div>
    </motion.div>
  );
};

export default LiveRivals;
