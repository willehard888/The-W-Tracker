import { useState } from "react";
import { ChevronLeft, Search, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import BadgeCard from "@/components/BadgeCard";
import { cn } from "@/lib/utils";

const BadgeCompare = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<{ user_id: string; username: string } | null>(null);

  const { data: allBadges } = useQuery({
    queryKey: ["all-badges"],
    queryFn: async () => {
      const { data } = await supabase.from("badges").select("*").order("rarity");
      return data || [];
    },
  });

  const { data: myBadgeIds } = useQuery({
    queryKey: ["my-badges", profile?.user_id],
    queryFn: async () => {
      if (!profile) return [];
      const { data } = await supabase
        .from("user_badges")
        .select("badge_id")
        .eq("user_id", profile.user_id);
      return data?.map((b) => b.badge_id) || [];
    },
    enabled: !!profile,
  });

  const { data: users } = useQuery({
    queryKey: ["search-users", searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, username")
        .neq("user_id", profile?.user_id || "")
        .ilike("username", `%${searchQuery}%`)
        .limit(10);
      return data || [];
    },
    enabled: searchQuery.length >= 2,
  });

  const { data: theirBadgeIds } = useQuery({
    queryKey: ["their-badges", selectedUser?.user_id],
    queryFn: async () => {
      if (!selectedUser) return [];
      const { data } = await supabase
        .from("user_badges")
        .select("badge_id")
        .eq("user_id", selectedUser.user_id);
      return data?.map((b) => b.badge_id) || [];
    },
    enabled: !!selectedUser,
  });

  const myCount = myBadgeIds?.length || 0;
  const theirCount = theirBadgeIds?.length || 0;

  return (
    <div className="min-h-full pb-4 px-4 pt-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 animate-reveal">
        <button onClick={() => navigate("/profile")} className="p-1.5 rounded-lg hover:bg-secondary transition-colors active:scale-95">
          <ChevronLeft size={20} />
        </button>
        
        <div>
          <h1 className="font-display text-2xl font-black tracking-tight">Badge Compare</h1>
          <p className="text-xs text-muted-foreground">See how your collection stacks up</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4 animate-reveal animate-reveal-delay-1">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by username..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (e.target.value.length < 2) setSelectedUser(null);
          }}
          className="w-full rounded-xl border border-border bg-card pl-10 pr-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-gold/40 transition-colors"
        />
      </div>

      {/* Search Results */}
      {!selectedUser && users && users.length > 0 && (
        <div className="mb-4 rounded-xl border border-border bg-card overflow-hidden animate-reveal">
          {users.map((u) => (
            <button
              key={u.user_id}
              onClick={() => {
                setSelectedUser(u);
                setSearchQuery(u.username);
              }}
              className="flex items-center gap-3 w-full p-3 hover:bg-secondary/50 transition-colors text-left active:scale-[0.98] border-b border-border last:border-0"
            >
              <div className="h-8 w-8 rounded-full bg-gold/10 flex items-center justify-center text-sm font-bold text-gold">
                {u.username.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-semibold">@{u.username}</span>
            </button>
          ))}
        </div>
      )}

      {/* Comparison */}
      {selectedUser && (
        <div className="animate-reveal">
          {/* Score Header */}
          <div className="flex items-center justify-between mb-4 p-4 rounded-xl border border-border bg-card">
            <div className="text-center flex-1">
              <p className="text-xs text-muted-foreground mb-1">You</p>
              <p className="font-display text-2xl font-black text-gold">{myCount}</p>
              <p className="text-[11px] text-muted-foreground">badges</p>
            </div>
            <div className="flex items-center justify-center">
              <Shield size={24} className="text-muted-foreground" />
            </div>
            <div className="text-center flex-1">
              <p className="text-xs text-muted-foreground mb-1">@{selectedUser.username}</p>
              <p className="font-display text-2xl font-black text-foreground">{theirCount}</p>
              <p className="text-[11px] text-muted-foreground">badges</p>
            </div>
          </div>

          {/* Badge Grid Comparison */}
          <div className="space-y-3">
            {allBadges?.map((badge) => {
              const iHave = myBadgeIds?.includes(badge.id) || false;
              const theyHave = theirBadgeIds?.includes(badge.id) || false;

              return (
                <div
                  key={badge.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl border transition-all",
                    iHave && theyHave ? "border-gold/20 bg-gold/[0.03]" :
                    iHave && !theyHave ? "border-xp-green/20 bg-xp-green/[0.03]" :
                    !iHave && theyHave ? "border-destructive/20 bg-destructive/[0.03]" :
                    "border-border bg-card opacity-40"
                  )}
                >
                  <div className="text-2xl w-10 text-center">{badge.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate">{badge.name}</p>
                    <p className={cn(
                      "text-[10px] font-black uppercase tracking-[0.22em]",
                      badge.rarity === "legendary" ? "text-gold" :
                      badge.rarity === "epic" ? "text-[hsl(var(--badge-epic))]" :
                      badge.rarity === "rare" ? "text-[hsl(var(--badge-rare))]" :
                      "text-muted-foreground"
                    )}>
                      {badge.rarity}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", iHave ? "bg-xp-green/15 text-xp-green" : "bg-secondary text-muted-foreground")}>
                      {iHave ? "✓" : "✗"}
                    </span>
                    <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", theyHave ? "bg-xp-green/15 text-xp-green" : "bg-secondary text-muted-foreground")}>
                      {theyHave ? "✓" : "✗"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!selectedUser && (!users || users.length === 0) && (
        <div className="flex flex-col items-center justify-center text-center mt-16 animate-reveal">
          <Shield size={48} className="text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">Search for a user to compare badges</p>
        </div>
      )}
    </div>
  );
};

export default BadgeCompare;
