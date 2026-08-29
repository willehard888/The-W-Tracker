import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { uniqueChannelName } from "@/lib/realtime";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { ChevronLeft, Send, MoreVertical, Ban, Flag } from "lucide-react";
import { toast } from "sonner";
import StatusAvatar from "@/components/StatusAvatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useBlockActions } from "@/hooks/use-blocking";
import BlockUserDialog from "@/components/BlockUserDialog";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const Chat = () => {
  const { partnerId } = useParams<{ partnerId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { block, report } = useBlockActions();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: partner } = useQuery({
    queryKey: ["chat-partner", partnerId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, username, avatar_url, status_tier, level, is_elite")
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
      void supabase
        .from("direct_messages")
        .update({ read: true })
        .eq("receiver_id", user.id)
        .eq("sender_id", partnerId)
        .eq("read", false)
        .then(({ error }) => {
          if (!error) queryClient.invalidateQueries({ queryKey: ["conversations"] });
        });
    }
  }, [messages, user, partnerId, queryClient]);

  // Realtime subscription
  useEffect(() => {
    if (!user || !partnerId) return;
    const channel = supabase
      .channel(uniqueChannelName("chat", partnerId))
      .on(
        "postgres_changes",
        // Server-side filter: without it this client received EVERY DM in the
        // product and filtered in JS. Realtime allows one filter — receiver
        // covers messages TO me; my own sends invalidate in handleSend.
        { event: "INSERT", schema: "public", table: "direct_messages", filter: `receiver_id=eq.${user.id}` },
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
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages?.length]);

  const handleSend = async () => {
    if (!user || !partnerId || !text.trim()) return;
    setSending(true);
    const messageContent = text.trim();
    try {
      // supabase-js returns { error } — it does NOT throw. Without this check
      // an RLS/DB failure cleared the input and the message never existed.
      const { error } = await supabase.from("direct_messages").insert({
        sender_id: user.id,
        receiver_id: partnerId,
        content: messageContent,
      });
      if (error) {
        toast.error("Message didn't send — try again.");
        return; // keep the text in the input so nothing is lost
      }

      // Trigger push notification for receiver (best-effort)
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
      } catch {
        /* push is non-critical — the message itself is already saved */
      }

      setText("");
      queryClient.invalidateQueries({ queryKey: ["chat-messages", partnerId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    } catch {
      toast.error("Message didn't send — try again.");
    } finally {
      // Without finally, a network throw left the send button spinning forever.
      setSending(false);
    }
  };

  const partnerTier = (partner as any)?.status_tier || "recruit";
  // EARNED elite crown, not the paid flag.
  const partnerIsElite = ["elite", "apex", "legend"].includes(partnerTier);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header — sticky, themed with subtle gold sheen */}
      <div className="shrink-0 relative border-b border-border/60 bg-card/80 backdrop-blur-xl px-4 py-3 safe-top">
        <div
          className="absolute inset-0 pointer-events-none opacity-40"
          style={{
            background:
              "linear-gradient(180deg, hsl(var(--gold) / 0.06) 0%, transparent 100%)",
          }}
          aria-hidden
        />
        <div className="relative flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => navigate("/messages")}
            className="-ml-2 rounded-full"
            aria-label="Back"
          >
            <ChevronLeft size={20} />
          </Button>
          <button
            onClick={() => navigate(`/user/${partnerId}`)}
            className="flex items-center gap-2.5 flex-1 min-w-0 active:opacity-70 transition-opacity"
          >
            <StatusAvatar
              src={partner?.avatar_url}
              name={partner?.username}
              tier={partnerTier}
              size="xs"
            />
            <div className="text-left min-w-0">
              <p className="text-sm font-semibold leading-tight truncate flex items-center gap-1.5">
                @{partner?.username || "..."}
                {partnerIsElite && (
                  <span className="text-[10px] font-black uppercase tracking-wider text-gold bg-gold/10 border border-gold/30 rounded-full px-1.5 py-[1px] leading-none">
                    Elite
                  </span>
                )}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Level {partner?.level || "?"} · {partnerTier.replace("_", " ")}
              </p>
            </div>
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button aria-label="Conversation options" className="h-10 w-10 shrink-0 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground active:scale-90 transition">
                <MoreVertical size={18} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[180px]">
              <DropdownMenuItem
                onClick={() => report("direct_message", partnerId!, partnerId!, `Reported chat with @${partner?.username ?? "user"}`)}
              >
                <Flag size={14} className="mr-2" aria-hidden /> Report
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setShowBlockConfirm(true)}
              >
                <Ban size={14} className="mr-2" aria-hidden /> Block user
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 space-y-1.5"
      >
        {(!messages || messages.length === 0) && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
            <div className="h-14 w-14 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center mb-3">
              <Send size={20} className="text-gold/70" />
            </div>
            <p className="text-sm font-semibold text-foreground">Start the conversation</p>
            <p className="text-xs text-muted-foreground/70 mt-1 max-w-[220px]">
              Say something to @{partner?.username || "them"} — messages are private.
            </p>
          </div>
        )}
        {messages?.map((msg, idx) => {
          const isOwn = msg.sender_id === user?.id;
          const prev = messages[idx - 1];
          const next = messages[idx + 1];
          const sameAsPrev = prev && prev.sender_id === msg.sender_id;
          const sameAsNext = next && next.sender_id === msg.sender_id;
          const showTime = !next || next.sender_id !== msg.sender_id ||
            new Date(next.created_at).getTime() - new Date(msg.created_at).getTime() > 5 * 60 * 1000;

          return (
            <div
              key={msg.id}
              className={cn(
                "flex",
                isOwn ? "justify-end" : "justify-start",
                sameAsPrev ? "mt-0.5" : "mt-2"
              )}
            >
              <div className={cn("max-w-[78%] flex flex-col", isOwn ? "items-end" : "items-start")}>
                <div
                  className={cn(
                    "px-3.5 py-2 text-sm leading-relaxed break-words",
                    isOwn
                      ? "bg-gradient-to-br from-gold/25 to-gold/10 text-foreground border border-gold/25 shadow-[0_1px_0_hsl(var(--gold)/0.25)_inset]"
                      : "bg-secondary/80 text-foreground border border-border/50",
                    // Smart bubble corners based on grouping
                    isOwn
                      ? cn(
                          "rounded-2xl",
                          sameAsPrev && "rounded-tr-md",
                          sameAsNext && "rounded-br-md"
                        )
                      : cn(
                          "rounded-2xl",
                          sameAsPrev && "rounded-tl-md",
                          sameAsNext && "rounded-bl-md"
                        )
                  )}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
                {showTime && (
                  <p
                    className={cn(
                      "text-[10px] mt-1 px-1",
                      isOwn ? "text-gold/50" : "text-muted-foreground/50"
                    )}
                  >
                    {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                    {isOwn && msg.read && <span className="ml-1">· seen</span>}
                  </p>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-border/60 bg-card/90 backdrop-blur-xl px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Message..."
              maxLength={1000}
              className={cn(
                "w-full h-11 px-4 rounded-full border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none transition-all",
                text.trim()
                  ? "border-gold/40 focus:ring-2 focus:ring-gold/30 shadow-[0_0_0_1px_hsl(var(--gold)/0.15)]"
                  : "border-border focus:ring-1 focus:ring-border"
              )}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
          </div>
          <Button
            variant={text.trim() ? "ember" : "secondary"}
            size="icon-lg"
            onClick={handleSend}
            loading={sending}
            disabled={!text.trim()}
            className="rounded-full shrink-0 h-11 w-11"
            aria-label="Send"
          >
            <Send size={16} />
          </Button>
        </div>
      </div>

      <BlockUserDialog
        open={showBlockConfirm}
        username={partner?.username}
        onOpenChange={setShowBlockConfirm}
        onConfirm={() => {
          block(partnerId!, partner?.username);
          navigate("/messages");
        }}
      />
    </div>
  );
};

export default Chat;
