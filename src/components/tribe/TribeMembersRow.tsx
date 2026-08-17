import { Crown, Shield, ShieldCheck } from "lucide-react";
import TierUsername from "@/components/TierUsername";
import { avatarUrl } from "@/lib/img";

export interface TribeMember {
  user_id: string;
  username: string;
  avatar_url?: string | null;
  role?: string;
  status_tier?: string | null;
}

/**
 * Horizontal members strip for a tribe (owner/admin badges, tap to open profile).
 * `verifiedIds` = members with HealthKit-verified discipline → shown as a count
 * in the header + a green check on their avatar (the verified-discipline wedge,
 * extended to the tribe level).
 */
const TribeMembersRow = ({
  members,
  onMemberClick,
  verifiedIds,
}: {
  members: TribeMember[];
  onMemberClick: (userId: string) => void;
  verifiedIds?: Set<string>;
}) => {
  if (members.length === 0) return null;
  const verifiedCount = verifiedIds ? members.filter((m) => verifiedIds.has(m.user_id)).length : 0;

  return (
    <div className="mb-4">
      <h2 className="text-[10px] font-black tracking-widest uppercase text-muted-foreground mb-2 flex items-center gap-1.5">
        <span>Members · {members.length}</span>
        {verifiedCount > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[hsl(var(--xp-green))]">
            <ShieldCheck size={11} /> {verifiedCount} verified
          </span>
        )}
      </h2>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar">
        {members.map((m) => (
          <button key={m.user_id} onClick={() => onMemberClick(m.user_id)}
            className="flex flex-col items-center gap-1 shrink-0 w-14">
            <div className={`relative h-12 w-12 rounded-full border-2 ${m.role === "owner" ? "border-gold shadow-[0_0_12px_hsl(var(--gold)/0.6)]" : "border-[hsl(var(--ember))]/30"} bg-secondary overflow-hidden`}>
              {m.avatar_url ? (
                <img loading="lazy" decoding="async" src={avatarUrl(m.avatar_url, 48)} alt={m.username} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-[10px] font-black text-muted-foreground">
                  {m.username.slice(0, 2).toUpperCase()}
                </div>
              )}
              {verifiedIds?.has(m.user_id) && (
                <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-background border border-[hsl(var(--xp-green))]/50 flex items-center justify-center">
                  <ShieldCheck size={9} className="text-[hsl(var(--xp-green))]" />
                </div>
              )}
              {m.role === "owner" && (
                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 px-1 py-px rounded-sm bg-gradient-to-r from-gold to-[hsl(var(--ember))] shadow-[0_0_6px_hsl(var(--gold)/0.7)] flex items-center gap-0.5">
                  <Crown size={6} className="text-background" strokeWidth={3} fill="currentColor" />
                  <span className="text-[6px] font-black tracking-wider uppercase text-background leading-none">Founder</span>
                </div>
              )}
              {m.role === "admin" && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1 py-px rounded-sm bg-[hsl(var(--ember))]/90">
                  <Shield size={6} className="text-background" />
                </div>
              )}
            </div>
            <TierUsername
              username={m.username}
              tier={m.status_tier || "recruit"}
              showAt={false}
              className={`text-[9px] truncate w-full text-center ${m.role === "owner" ? "font-black" : ""}`}
            />
          </button>
        ))}
      </div>
      <div className="apex-divider mt-3" />
    </div>
  );
};

export default TribeMembersRow;
