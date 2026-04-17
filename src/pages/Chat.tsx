import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { ChevronLeft, Send } from "lucide-react";
import StatusAvatar from "@/components/StatusAvatar";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const Chat = () => {
  const { partnerId } = useParams<{ partnerId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: partner } = useQuery({
    queryKey: ["chat-partner", partnerId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, username, avatar_url, status_tier, level")
        .eq("user_id", partnerId!)
        .single();
      return data;
    },
    enabled: !!partnerId,
  });

  const { data: messages } = useQuery({
    queryKey: ["chat-messages", partnerId],
    queryFn: async () => {
      if (!user || !partnerId) return [];
      const { data } = await supabase
        .from("direct_messages")
        .select("*")
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`
        )
        .order("created_at", { ascending: true });
      return data || [];
    },
    enabled: !!user && !!partnerId,
  });

  // Mark messages as read
  useEffect(() => {
    if (!user || !partnerId || !messages) return;
    const unread = messages.filter((m) => m.receiver_id === user.id && !m.read);
    if (unread.length > 0) {
      supabase
        .from("direct_messages")
        .update({ read: true })
        .eq("receiver_id", user.id)
        .eq("sender_id", partnerId)
        .eq("read", false)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["conversations"] });
        });
    }
  }, [messages, user, partnerId, queryClient]);

  // Realtime subscription
  useEffect(() => {
    if (!user || !partnerId) return;
    const channel = supabase
      .channel(`chat-${partnerId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages" },
        (payload) => {
          const msg = payload.new as any;
          if (
            (msg.sender_id === user.id && msg.receiver_id === partnerId) ||
            (msg.sender_id === partnerId && msg.receiver_id === user.id)
          ) {
            queryClient.invalidateQueries({ queryKey: ["chat-messages", partnerId] });
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, partnerId, queryClient]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  const handleSend = async () => {
    if (!user || !partnerId || !text.trim()) return;
    setSending(true);
    const messageContent = text.trim();
    await supabase.from("direct_messages").insert({
      sender_id: user.id,
      receiver_id: partnerId,
      content: messageContent,
    });

    // Trigger push notification for receiver
    try {
      const { data: senderProfile } = await supabase
        .from("profiles")
        .select("username")
        .eq("user_id", user.id)
        .single();
      
      await supabase.functions.invoke("notify-message", {
        body: {
          receiver_id: partnerId,
          sender_username: senderProfile?.username || "Someone",
          message_preview: messageContent,
        },
      });
    } catch (e) {
      console.log("Push notification failed (non-critical):", e);
    }

    setText("");
    setSending(false);
    queryClient.invalidateQueries({ queryKey: ["chat-messages", partnerId] });
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
  };

  return (
    <div className="fixed inset-0 flex flex-col safe-top bg-background z-30">
      {/* Header */}
      <div className="shrink-0 bg-card/95 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate("/messages")} className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft size={20} />
        </button>
        <button onClick={() => navigate(`/user/${partnerId}`)} className="flex items-center gap-2.5">
          <StatusAvatar src={partner?.avatar_url} name={partner?.username} tier={(partner as any)?.status_tier || 'recruit'} size="xs" />
          <div className="text-left">
            <p className="text-sm font-semibold leading-none">@{partner?.username || "..."}</p>
            <p className="text-[10px] text-muted-foreground">Level {partner?.level || "?"}</p>
          </div>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {(!messages || messages.length === 0) && (
          <p className="text-xs text-muted-foreground/50 text-center py-8">Start the conversation</p>
        )}
        {messages?.map((msg) => {
          const isOwn = msg.sender_id === user?.id;
          return (
            <div key={msg.id} className={cn("flex", isOwn ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                  isOwn
                    ? "bg-gold/15 text-foreground rounded-br-sm"
                    : "bg-secondary text-foreground rounded-bl-sm"
                )}
              >
                <p className="overflow-wrap-break-word">{msg.content}</p>
                <p className={cn(
                  "text-[9px] mt-1",
                  isOwn ? "text-gold/50 text-right" : "text-muted-foreground/40"
                )}>
                  {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input - sticky at bottom, above BottomNav */}
      <div className="shrink-0 bg-card/95 backdrop-blur-md border-t border-border px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="max-w-md mx-auto flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message..."
            maxLength={1000}
            className="flex-1 h-10 px-4 rounded-full border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-purple-500/30 transition-shadow"
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sending}
            className={cn(
              "h-10 w-10 rounded-full flex items-center justify-center transition-all active:scale-95 shrink-0",
              text.trim() ? "bg-purple-500 text-white" : "bg-secondary text-muted-foreground"
            )}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chat;
