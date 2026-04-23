import { useNavigate } from "react-router-dom";
import { Trophy, Rocket } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTopInviters, useReferralStats } from "@/hooks/use-referral-stats";
import StatusAvatar from "@/components/StatusAvatar";
import TierUsername from "@/components/TierUsername";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TopInvitersWidgetProps {
  limit?: number;
  className?: string;
  /** Hide the CTA in the empty state (e.g. when already on /referrals) */
  hideEmptyCta?: boolean;
}

const rankColor = (i: number) => {
  if (i === 0) return "text-gold";
  if (i === 1) return "text-muted-foreground";
  if (i === 2) return "text-amber-600";
  return "text-muted-foreground";
};

const TopInvitersWidget = ({ limit = 10, className, hideEmptyCta = false }: TopInvitersWidgetProps) => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: inviters, isLoading } = useTopInviters(limit);
  const { data: myStats } = useReferralStats(profile?.user_id);

  const myUserId = profile?.user_id;
  const inList = !!inviters?.some((inv) => inv.user_id === myUserId);
  const hasMySignups = (myStats?.signupCount ?? 0) > 0;

  return (
    <section className={cn("rounded-xl border border-border bg-card p-4", className)}>
      <header className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Trophy size={16} className="text-gold" />
          <h2 className="font-display font-bold text-sm tracking-tight">Top Inviters This Month</h2>
        </div>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
          Resets 1st
        </span>
      </header>

      {isLoading && (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-2.5 w-32" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && (!inviters || inviters.length === 0) && (
        <div className="py-6 text-center">
          <div className="h-10 w-10 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-2">
            <Rocket size={18} className="text-gold" />
          </div>
          <p className="text-sm font-semibold mb-1">Be the first inviter this month 🚀</p>
          <p className="text-xs text-muted-foreground mb-3">
            Climb this board — every paid invite earns XP, credits & badges.
          </p>
          {!hideEmptyCta && (
            <Button variant="ember" size="sm" onClick={() => navigate("/referrals")}>
              Get your link
            </Button>
          )}
        </div>
      )}

      {!isLoading && inviters && inviters.length > 0 && (
        <ul className="space-y-1.5">
          {inviters.map((inv, i) => {
            const isMe = inv.user_id === myUserId;
            return (
              <li
                key={inv.user_id}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors",
                  isMe ? "bg-gold/10 ring-1 ring-gold/40" : "hover:bg-secondary/40",
                )}
              >
                <span
                  className={cn(
                    "w-5 text-center font-display font-black text-sm tabular-nums shrink-0",
                    rankColor(i),
                  )}
                >
                  {i + 1}
                </span>
                <button
                  onClick={() => navigate(`/user/${inv.user_id}`)}
                  className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                >
                  <StatusAvatar
                    src={inv.avatar_url}
                    name={inv.username}
                    tier={inv.status_tier || "recruit"}
                    size="sm"
                    showBadge={false}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">
                      <TierUsername
                        username={inv.username}
                        tier={inv.status_tier || "recruit"}
                      />
                      {isMe && (
                        <span className="ml-1 text-[10px] text-gold/70 font-medium">
                          (you)
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                      <span className="text-gold font-bold">
                        {Number(inv.converted_count)} paid
                      </span>
                      {" · "}
                      <span>{Number(inv.signup_count)} signups</span>
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {!isLoading && inviters && inviters.length > 0 && !inList && hasMySignups && (
        <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate">
              You: {myStats?.signupCount ?? 0} signups ·{" "}
              <span className="text-gold">{myStats?.convertedCount ?? 0} paid</span>
            </p>
            <p className="text-[11px] text-muted-foreground">Keep pushing to crack the top {limit}.</p>
          </div>
          {!hideEmptyCta && (
            <Button size="sm" variant="gold-outline" onClick={() => navigate("/referrals")}>
              Invite
            </Button>
          )}
        </div>
      )}
    </section>
  );
};

export default TopInvitersWidget;
