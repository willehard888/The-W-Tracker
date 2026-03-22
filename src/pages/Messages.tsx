import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const Messages = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["conversations", user?.id],
    queryFn: async () => {
      if (!user) return [];
      // Get all messages involving this user
      const { data: msgs } = await supabase
        .from("direct_messages")
        .select("*")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false });
      if (!msgs || msgs.length === 0) return [];

      // Group by conversation partner
      const convMap = new Map<string, { partnerId: string; lastMessage: any; unread: number }>();
      for (const msg of msgs) {
        const partnerId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        if (!convMap.has(partnerId)) {
          convMap.set(partnerId, {
            partnerId,
            lastMessage: msg,
            unread: 0,
          });
        }
        const conv = convMap.get(partnerId)!;
        if (!msg.read && msg.receiver_id === user.id) {
          conv.unread++;
        }
      }

      // Fetch profiles
      const partnerIds = [...convMap.keys()];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username, avatar_url, status_tier")
        .in("user_id", partnerIds);
      const profileMap = Object.fromEntries((profiles || []).map((p) => [p.user_id, p]));

      return [...convMap.values()].map((c) => ({
        ...c,
        profile: profileMap[c.partnerId],
      }));
    },
    enabled: !!user,
  });

  return (
    <div className="min-h-screen pb-24 px-4 pt-6">
      <div className="animate-reveal mb-6">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <MessageCircle size={16} className="text-purple-400" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight leading-none">Messages</h1>
            <p className="text-[10px] text-muted-foreground mt-0.5">Direct messages</p>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4 animate-pulse flex gap-3">
              <div className="h-10 w-10 rounded-full bg-secondary" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-24 bg-secondary rounded" />
                <div className="h-2 w-40 bg-secondary rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && (!conversations || conversations.length === 0) && (
        <div className="text-center py-16 animate-reveal animate-reveal-delay-1">
          <div className="h-16 w-16 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
            <MessageCircle size={28} className="text-purple-400/40" />
          </div>
          <p className="text-sm font-semibold text-muted-foreground">No messages yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Visit a user's profile to start a conversation</p>
        </div>
      )}

      <div className="space-y-2 animate-reveal animate-reveal-delay-1">
        {conversations?.map((conv) => (
          <button
            key={conv.partnerId}
            onClick={() => navigate(`/chat/${conv.partnerId}`)}
            className={cn(
              "w-full flex items-center gap-3 rounded-xl border p-4 text-left transition-all active:scale-[0.98] card-depth",
              conv.unread > 0 ? "border-purple-500/30 bg-purple-500/5" : "border-border bg-card"
            )}
          >
            <Avatar className="h-10 w-10 shrink-0">
              {conv.profile?.avatar_url ? <AvatarImage src={conv.profile.avatar_url} /> : null}
              <AvatarFallback className="text-xs font-bold bg-secondary">
                {conv.profile?.username?.charAt(0)?.toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className={cn("text-sm font-semibold truncate", conv.unread > 0 && "text-foreground")}>
                  @{conv.profile?.username || "unknown"}
                </p>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {formatDistanceToNow(new Date(conv.lastMessage.created_at), { addSuffix: true })}
                </span>
              </div>
              <p className={cn(
                "text-xs truncate mt-0.5",
                conv.unread > 0 ? "text-foreground/80 font-medium" : "text-muted-foreground"
              )}>
                {conv.lastMessage.sender_id === user?.id && "You: "}
                {conv.lastMessage.content}
              </p>
            </div>
            {conv.unread > 0 && (
              <div className="h-5 min-w-5 px-1.5 rounded-full bg-purple-500 flex items-center justify-center">
                <span className="text-[10px] font-bold text-white">{conv.unread}</span>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default Messages;
