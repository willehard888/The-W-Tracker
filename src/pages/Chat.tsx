import { backOr } from "@/lib/nav";
import { Input } from "@/components/ui/input";
import { fmtRelative } from "@/lib/format";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { captureException } from "@/lib/observability";
import { uniqueChannelName } from "@/lib/realtime";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { Send, MoreVertical, Ban, Flag } from "lucide-react";
import { toast } from "sonner";
import StatusAvatar from "@/components/StatusAvatar";
import { Button } from "@/components/ui/button";
import PageBar from "@/components/ui/page-bar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useBlockActions } from "@/hooks/use-blocking";
import BlockUserDialog from "@/components/BlockUserDialog";
import EmptyState from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

const Chat = () => {
  const { partnerId } = useParams<{ partnerId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { block, report } = useBlockActions();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  // The bubble that lands with commit-pop — only the one this session just sent.
  const [justSentId, setJustSentId] = useState<string | null>(null);
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
      // The newest screenful, not the whole thread — a long conversation
      // used to download and re-render in full on every incoming message.
      const { data } = await supabase
        .from("direct_messages")
        .select("*")
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`
        )
        .order("created_at", { ascending: false })
        .limit(60);
      return (data || []).reverse();
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
          if (!error) {
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
            // Squad's Messages badge counts unread rows — reading a thread
            // must clear it too.
            queryClient.invalidateQueries({ queryKey: ["direct-messages"] });
          }
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
          const msg = payload.new as { id: string; sender_id: string; receiver_id: string };
          if (
            (msg.sender_id === user.id && msg.receiver_id === partnerId) ||
            (msg.sender_id === partnerId && msg.receiver_id === user.id)
          ) {
            // The row arrives with the event — append it instead of
            // refetching the thread.
            queryClient.setQueryData<typeof messages>(["chat-messages", partnerId], (old) =>
              !old ? old : old.some((m) => m.id === msg.id) ? old : [...old, msg as NonNullable<typeof messages>[number]],
            );
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, partnerId, queryClient]);

  // Follow new messages only when the reader is already near the bottom;
  // the first paint always lands on the newest.
  const followRef = useRef(true);
  useEffect(() => {
    const el = bottomRef.current?.parentElement;
    if (el && messages?.length) {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
      if (!followRef.current && !nearBottom) return;
      followRef.current = false;
    }
    bottomRef.current?.scrollIntoView({ behavior: followRef.current ? "auto" : "smooth", block: "end" });
  }, [messages?.length]);

  const handleSend = async () => {
    if (!user || !partnerId || !text.trim()) return;
    setSending(true);
    const messageContent = text.trim();
    try {
      // supabase-js returns { error } — it does NOT throw. Without this check
      // an RLS/DB failure cleared the input and the message never existed.
      const { data: sent, error } = await supabase.from("direct_messages")
        .insert({ sender_id: user.id, receiver_id: partnerId, content: messageContent }).select("id").single();
      if (error) {
        toast.error("Message didn't send — try again.");
        return; // keep the text in the input so nothing is lost
      }

      // Push for the receiver. Best-effort for the SENDER — the message is
      // already saved, so nothing is retried and nothing is shown — but not
      // best-effort for us: `functions.invoke` RESOLVES with `{ error }` on a
      // non-2xx, it does not throw, so the catch below could never fire and the
      // error was never read. A DM nobody is ever told about looked identical to
      // a delivered one.
      try {
        const { data: senderProfile } = await supabase
          .from("profiles")
          .select("username")
          .eq("user_id", user.id)
          .single();

        const { error: pushError } = await supabase.functions.invoke("notify-message", {
          body: {
            receiver_id: partnerId,
            sender_username: senderProfile?.username || "Someone",
            message_preview: messageContent,
          },
        });
        if (pushError) captureException(pushError, { where: "chat.notifyMessage" });
      } catch (e) {
        // Only a transport throw reaches here.
        captureException(e, { where: "chat.notifyMessage" });
      }

      setText("");
      setJustSentId(sent?.id ?? null);
      queryClient.invalidateQueries({ queryKey: ["chat-messages", partnerId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["direct-messages"] });
    } catch {
      toast.error("Message didn't send — try again.");
    } finally {
      // Without finally, a network throw left the send button spinning forever.
      setSending(false);
    }
  };

  const partnerTier = partner?.status_tier || "recruit";
  // EARNED elite crown, not the paid flag.
  const partnerIsElite = ["elite", "apex", "legend"].includes(partnerTier);

  return (
    <div className="flex flex-col h-full bg-background">
      <PageBar
        sticky={false}
        onBack={() => backOr(navigate, "/messages")}
        title={
          <button
            onClick={() => navigate(`/user/${partnerId}`)}
            className="flex items-center gap-2.5 w-full min-w-0 active:opacity-70 transition-opacity"
          >
            <StatusAvatar
              src={partner?.avatar_url}
              name={partner?.username}
              tier={partnerTier}
              size="xs"
            />
            <div className="text-left min-w-0">
              <p className="text-sm font-semibold leading-tight truncate flex items-center gap-1.5">
                @{partner?.username || "…"}
                {partnerIsElite && (
                  <span className="text-[10px] font-bold text-gold bg-gold/10 border border-gold/30 rounded-full px-1.5 py-[1px] leading-none">
                    Elite
                  </span>
                )}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Level {partner?.level || "?"} · {partnerTier.replace("_", " ")}
              </p>
            </div>
          </button>
        }
        action={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Conversation options" className="rounded-full text-muted-foreground">
                <MoreVertical size={18} />
              </Button>
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
        }
      />

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 space-y-1.5"
      >
        {(!messages || messages.length === 0) && (
          <div className="flex flex-col justify-center h-full">
            <EmptyState size="compact" icon={Send} title="Start the conversation" description={`Say something to @${partner?.username || "them"}. Messages are private.`} />
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
                    msg.id === justSentId && "commit-pop origin-bottom-right",
                    isOwn
                      ? "bg-gradient-to-br from-gold/25 to-gold/10 text-foreground border border-gold/25 shadow-[0_1px_0_hsl(var(--gold)/0.25)_inset]"
                      : "bg-secondary/80 text-foreground border border-border/50",
                    // Smart bubble corners based on grouping
                    "rounded-2xl",
                    isOwn
                      ? cn(sameAsPrev && "rounded-tr-md", sameAsNext && "rounded-br-md")
                      : cn(sameAsPrev && "rounded-tl-md", sameAsNext && "rounded-bl-md")
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
                    {fmtRelative(msg.created_at)}
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
      <div className="shrink-0 border-t border-border/60 bg-card px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="flex gap-2 items-center">
          <div className="flex-1 relative">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={partner?.username ? `Message @${partner.username}` : "Message…"}
              maxLength={1000}
              className="h-11 rounded-full px-4 text-sm"
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
