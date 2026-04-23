import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Send, Sparkles, ArrowLeft, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { hapticImpact } from "@/lib/haptics";

import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string };

const STORAGE_KEY = "w_coach_messages_v1";

const SUGGESTIONS = [
  "Build me a 4-day training split.",
  "How do I fix a broken streak mindset?",
  "Cold shower protocol — minimum effective dose?",
  "I slept 5h. How do I salvage today?",
];

const Coach = () => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Msg[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as Msg[];
    } catch {}
    return [];
  });
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40)));
    } catch {}
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }, [messages, streaming]);

  // Prefill input from coach nudge context (set by CoachNudgeCard)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("w_coach_nudge_context");
      if (raw) {
        const { headline, content } = JSON.parse(raw);
        const prompt = headline
          ? `About your nudge "${headline}" — ${content}\n\nGive me more detail and a concrete plan for today.`
          : `About your nudge — ${content}\n\nGive me more detail.`;
        setInput(prompt);
        sessionStorage.removeItem("w_coach_nudge_context");
      }
    } catch {}
  }, []);

  // No isElite gate — AI Coach is available to any active member (AccessGate handles membership).

  const send = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || streaming) return;
    hapticImpact("light");
    setInput("");

    const userMsg: Msg = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setStreaming(true);

    let assistantBuf = "";
    const upsertAssistant = (chunk: string) => {
      assistantBuf += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantBuf } : m));
        }
        return [...prev, { role: "assistant", content: assistantBuf }];
      });
    };

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-coach`;
      const resp = await fetch(url, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
        },
        body: JSON.stringify({ messages: next }),
      });

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({}));
        if (resp.status === 429) toast.error("Coach is busy. Try again in a moment.");
        else if (resp.status === 402) toast.error("AI credits exhausted.");
        else toast.error(err?.error ?? "Coach failed to respond.");
        setMessages((prev) => prev.slice(0, -1));
        setStreaming(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;

      while (!done) {
        const { value, done: d } = await reader.read();
        if (d) break;
        buffer += decoder.decode(value, { stream: true });

        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line || line.startsWith(":")) continue;
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (delta) upsertAssistant(delta);
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        console.error(e);
        toast.error("Connection lost.");
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const clearChat = () => {
    if (streaming) abortRef.current?.abort();
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
    hapticImpact("light");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-4 pt-3 pb-2 flex items-center justify-between border-b border-border/30 bg-background/60 backdrop-blur-xl">
        <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft size={18} />
        </Button>
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full gradient-gold flex items-center justify-center shadow-[0_0_18px_hsl(var(--gold)/0.4)]">
            <Sparkles size={14} className="text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="font-display text-sm font-black tracking-tight leading-none">W Coach</h1>
            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">Always on</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={clearChat} className="text-[11px]">
          Clear
        </Button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center pt-8 pb-4"
          >
            <div className="h-16 w-16 mx-auto rounded-full gradient-gold flex items-center justify-center mb-4 shadow-[0_0_40px_hsl(var(--gold)/0.45)]">
              <Sparkles size={26} className="text-primary-foreground" />
            </div>
            <h2 className="font-display text-xl font-black tracking-tight mb-1">Your AI Coach</h2>
            <p className="text-xs text-muted-foreground max-w-[260px] mx-auto mb-6">
              Ask anything. Training, sleep, discipline, mindset. Direct answers, no fluff.
            </p>
            <div className="flex flex-col gap-2 max-w-sm mx-auto">
              {SUGGESTIONS.map((s) => (
                <Button
                  key={s}
                  variant="outline"
                  size="sm"
                  onClick={() => send(s)}
                  className="justify-start text-left h-auto py-2.5 whitespace-normal"
                >
                  {s}
                </Button>
              ))}
            </div>
          </motion.div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
            >
              <div
                className={
                  m.role === "user"
                    ? "max-w-[82%] rounded-2xl rounded-br-md px-3.5 py-2.5 bg-gold text-primary-foreground text-sm whitespace-pre-wrap"
                    : "max-w-[88%] rounded-2xl rounded-bl-md px-3.5 py-2.5 bg-card/70 border border-border/40 text-sm prose prose-invert prose-sm max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-headings:my-2 prose-strong:text-foreground"
                }
              >
                {m.role === "assistant" ? (
                  <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
                ) : (
                  m.content
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {streaming && messages[messages.length - 1]?.role === "user" && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md px-3.5 py-2.5 bg-card/70 border border-border/40">
              <Loader2 size={14} className="animate-spin text-gold" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-border/30 bg-background/80 backdrop-blur-xl px-3 pt-3 pb-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask your coach…"
            rows={1}
            disabled={streaming}
            className="flex-1 resize-none rounded-2xl border border-border/50 bg-card/60 px-3.5 py-2.5 text-sm focus:outline-none focus:border-gold/60 focus:ring-1 focus:ring-gold/30 max-h-32 disabled:opacity-60"
            style={{ minHeight: 42 }}
          />
          <Button
            variant="ember"
            size="icon-lg"
            loading={streaming}
            disabled={!input.trim()}
            onClick={() => send()}
            className="shrink-0 rounded-2xl"
            aria-label="Send"
          >
            <Send size={16} />
          </Button>
        </div>
        <p className="text-[9px] text-muted-foreground/70 text-center mt-1.5">
          Coach gives general guidance — not medical, legal, or financial advice.
        </p>
      </div>
    </div>
  );
};

export default Coach;
