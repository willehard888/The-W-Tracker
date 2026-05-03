import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Send, Sparkles, ArrowLeft, Loader2, User, Brain, MessageCircle, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { hapticImpact } from "@/lib/haptics";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCoachProgram } from "@/hooks/use-coach-program";
import PremiumCoachUpsell from "@/components/coach/PremiumCoachUpsell";
import ProgramOnboarding from "@/components/coach/ProgramOnboarding";
import TodaySessionCard from "@/components/coach/TodaySessionCard";
import ProgramWeekAccordion from "@/components/coach/ProgramWeekAccordion";
import ProgressDashboard from "@/components/coach/ProgressDashboard";
import { ProfileSkeleton as PageSkeleton } from "@/components/skeletons/PageSkeleton";
import DailyMissionCard from "@/components/coach/DailyMissionCard";
import { useDailyPlan } from "@/hooks/use-daily-plan";
import HabitsTab from "@/components/coach/HabitsTab";
import AthleteProfileOnboarding from "@/components/coach/AthleteProfileOnboarding";
import GoalTrackerCard from "@/components/coach/GoalTrackerCard";
import EveningReflectionCard from "@/components/coach/EveningReflectionCard";
import PerformanceOSDashboard from "@/components/coach/PerformanceOSDashboard";
import { useAthleteProfile } from "@/hooks/use-athlete-profile";
import { supabase } from "@/integrations/supabase/client";

type Msg = { role: "user" | "assistant"; content: string };
const STORAGE_KEY = "w_coach_messages_v1";

const TABS = [
  { id: "today", label: "Today" },
  { id: "program", label: "Program" },
  { id: "habits", label: "Habits" },
  { id: "progress", label: "Progress" },
  { id: "chat", label: "Chat" },
] as const;
type TabId = typeof TABS[number]["id"];

const Coach = () => {
  const { session, isPremium, subscriptionLoading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>("today");
  const { isLoading, program, logs, currentWeek, todayDayIndex, refetch } = useCoachProgram();
  const { profile: athlete, isLoading: athleteLoading, refetch: refetchAthlete } = useAthleteProfile();

  if (subscriptionLoading) return <PageSkeleton />;
  if (!isPremium) return <PremiumCoachUpsell />;
  if (isLoading || athleteLoading) return <PageSkeleton />;

  // Gate: athlete profile must be completed before anything else.
  if (!athlete?.onboarded) {
    return (
      <div className="flex flex-col h-full">
        <Header onBack={() => navigate(-1)} />
        <AthleteProfileOnboarding onDone={() => refetchAthlete()} />
      </div>
    );
  }

  if (!program) {
    return (
      <div className="flex flex-col h-full overflow-y-auto safe-top">
        <Header onBack={() => navigate(-1)} />
        <ProgramOnboarding onGenerated={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header onBack={() => navigate(-1)} />

      {/* Tab strip */}
      <div className="shrink-0 px-3 pt-1 pb-3">
        <div className="flex gap-0.5 p-[3px] rounded-full bg-[hsl(255_14%_8%)] border border-border/40 shadow-[inset_0_1px_2px_hsl(0_0%_0%/0.4)]">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => { hapticImpact("light"); setTab(t.id); }}
                className={cn(
                  "flex-1 text-[10px] font-black uppercase tracking-[0.14em] py-1.5 px-1 rounded-full transition-all",
                  active
                    ? "bg-gradient-to-b from-[hsl(42_88%_62%)] to-[hsl(42_78%_48%)] text-[hsl(260_18%_4%)] shadow-[0_2px_8px_-1px_hsl(42_78%_54%/0.55)]"
                    : "text-muted-foreground/70",
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      {tab === "chat" ? (
        <ChatTab session={session} program={program} />
      ) : (
        <div className="flex-1 overflow-y-auto px-4 pb-8">
          {tab === "today" && (
            <div className="space-y-4">
              <GoalTrackerCard />
              <DailyMissionCard />
              <EveningReflectionCard />
              <TodaySessionCard
                program={program}
                currentWeek={currentWeek}
                todayDayIndex={todayDayIndex}
                logs={logs}
                onLogged={() => refetch()}
              />
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button type="button" onClick={() => navigate("/coach/profile")}
                  className="rounded-2xl border border-border/40 bg-card/40 px-3 py-3 flex items-center gap-2 text-left hover:border-[hsl(var(--gold)/0.4)] transition">
                  <User size={14} className="text-gold shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold truncate">Athlete profile</p>
                    <p className="text-[9px] text-muted-foreground">Tune your Coach</p>
                  </div>
                </button>
                <button type="button" onClick={() => navigate("/coach/memory")}
                  className="rounded-2xl border border-border/40 bg-card/40 px-3 py-3 flex items-center gap-2 text-left hover:border-[hsl(var(--gold)/0.4)] transition">
                  <Brain size={14} className="text-gold shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold truncate">Coach memory</p>
                    <p className="text-[9px] text-muted-foreground">What it remembers</p>
                  </div>
                </button>
              </div>
            </div>
          )}
          {tab === "program" && (
            <ProgramWeekAccordion program={program} currentWeek={currentWeek} logs={logs} />
          )}
          {tab === "habits" && <HabitsTab />}
          {tab === "progress" && (
            <div className="space-y-4">
              <PerformanceOSDashboard />
              <ProgressDashboard program={program} currentWeek={currentWeek} logs={logs} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const Header = ({ onBack }: { onBack: () => void }) => (
  <div className="shrink-0 px-4 pt-3 pb-2 flex items-center justify-between border-b border-border/30 bg-background/60 backdrop-blur-xl">
    <Button variant="ghost" size="icon-sm" onClick={onBack} aria-label="Back">
      <ArrowLeft size={18} />
    </Button>
    <div className="flex items-center gap-2">
      <div className="h-7 w-7 rounded-full gradient-gold flex items-center justify-center shadow-[0_0_18px_hsl(var(--gold)/0.4)]">
        <Sparkles size={14} className="text-primary-foreground" />
      </div>
      <div className="text-center">
        <h1 className="font-display text-sm font-black tracking-tight leading-none">W Coach</h1>
        <p className="text-[9px] text-gold tracking-widest uppercase mt-0.5 inline-flex items-center gap-1">
          <Crown size={8} /> Premium
        </p>
      </div>
    </div>
    <span className="w-9" />
  </div>
);

// ── Chat tab (preserved from prior implementation) ─────────────────────────────
const SUGGESTIONS = [
  "Adjust today's session — I'm low on sleep.",
  "What should I eat post-workout?",
  "How do I deload week 4 properly?",
  "Give me a 5-min pre-bed wind-down.",
];

const ChatTab = ({ session, program }: { session: any; program: any }) => {
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
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40))); } catch {}
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }, [messages, streaming]);

  const send = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || streaming) return;
    hapticImpact("light");
    setInput("");
    const userMsg: Msg = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setStreaming(true);

    let buf = "";
    const upsert = (chunk: string) => {
      buf += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: buf } : m));
        }
        return [...prev, { role: "assistant", content: buf }];
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
        body: JSON.stringify({
          messages: next,
          program_context: program ? {
            goal: program.goal,
            summary: program.ai_summary,
          } : null,
        }),
      });
      if (!resp.ok || !resp.body) {
        if (resp.status === 429) toast.error("Coach is busy. Try again in a moment.");
        else if (resp.status === 402) toast.error("AI credits exhausted.");
        else toast.error("Coach failed to respond.");
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
          if (json === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (delta) upsert(delta);
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") toast.error("Connection lost.");
    } finally {
      setStreaming(false);
      abortRef.current = null;
      // Fire-and-forget: distill durable facts from the last exchange into chat memory.
      try {
        if (buf && buf.length > 20 && session?.access_token) {
          const finalMsgs = [...next, { role: "assistant" as const, content: buf }];
          supabase.functions.invoke("coach-extract-memory", {
            body: { messages: finalMsgs.slice(-6) },
          }).catch(() => { /* silent */ });
        }
      } catch { /* silent */ }
    }
  };

  return (
    <>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center pt-6 pb-4">
            <p className="text-xs text-muted-foreground max-w-[260px] mx-auto mb-5">
              Coach knows your active program and last 7 days. Ask anything.
            </p>
            <div className="flex flex-col gap-2 max-w-sm mx-auto">
              {SUGGESTIONS.map((s) => (
                <Button key={s} variant="ember-glass" size="sm" onClick={() => send(s)}
                  className="justify-start text-left h-auto py-2.5 whitespace-normal">
                  {s}
                </Button>
              ))}
            </div>
          </div>
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
              <div className={m.role === "user"
                ? "max-w-[82%] rounded-2xl rounded-br-md px-3.5 py-2.5 bg-gold text-primary-foreground text-sm whitespace-pre-wrap"
                : "max-w-[88%] rounded-2xl rounded-bl-md px-3.5 py-2.5 bg-card/70 border border-border/40 text-sm prose prose-invert prose-sm max-w-none prose-p:my-1.5 prose-strong:text-foreground"
              }>
                {m.role === "assistant" ? <ReactMarkdown>{m.content || "…"}</ReactMarkdown> : m.content}
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
      <div className="shrink-0 border-t border-border/30 bg-background/80 backdrop-blur-xl px-3 pt-3 pb-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            placeholder="Ask your coach…"
            rows={1}
            disabled={streaming}
            className="flex-1 resize-none rounded-2xl border border-border/50 bg-card/60 px-3.5 py-2.5 text-sm focus:outline-none focus:border-gold/60 focus:ring-1 focus:ring-gold/30 max-h-32 disabled:opacity-60"
            style={{ minHeight: 42 }}
          />
          <Button variant="ember" size="icon-lg" loading={streaming} disabled={!input.trim()}
            onClick={() => send()} className="shrink-0 rounded-2xl" aria-label="Send">
            <Send size={16} />
          </Button>
        </div>
        <p className="text-[9px] text-muted-foreground/70 text-center mt-1.5">
          Educational guidance — not medical advice.
        </p>
      </div>
    </>
  );
};

export default Coach;
