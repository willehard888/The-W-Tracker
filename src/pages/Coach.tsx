import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Send, ArrowLeft, Loader2, User, Brain, X, Sparkles, BookOpen, RotateCw, Plus } from "lucide-react";
import { matchFaq, COACH_FAQ, FaqEntry } from "@/lib/coach-faq";
import FaqBrowser from "@/components/coach/FaqBrowser";
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
import HabitsTab from "@/components/coach/HabitsTab";
import AthleteProfileOnboarding from "@/components/coach/AthleteProfileOnboarding";
import GoalTrackerCard from "@/components/coach/GoalTrackerCard";
import EveningReflectionCard from "@/components/coach/EveningReflectionCard";
import PerformanceOSDashboard from "@/components/coach/PerformanceOSDashboard";
import TrainerBrief from "@/components/coach/TrainerBrief";
import WeekStrip from "@/components/coach/WeekStrip";
import { useAthleteProfile } from "@/hooks/use-athlete-profile";
import { supabase } from "@/integrations/supabase/client";

type Msg = { role: "user" | "assistant"; content: string };
const STORAGE_KEY = "w_coach_messages_v1";

const Coach = () => {
  const { session, isPremium, subscriptionLoading } = useAuth();
  const navigate = useNavigate();
  const { isLoading, program, logs, currentWeek, todayDayIndex, refetch } = useCoachProgram();
  const { profile: athlete, isLoading: athleteLoading, refetch: refetchAthlete } = useAthleteProfile();

  if (subscriptionLoading) return <PageSkeleton />;
  if (!isPremium) return <PremiumCoachUpsell />;
  if (isLoading || athleteLoading) return <PageSkeleton />;

  if (!athlete?.onboarded) {
    return (
      <div className="flex flex-col h-full">
        <MinimalTopBar onBack={() => navigate(-1)} navigate={navigate} />
        <AthleteProfileOnboarding onDone={() => refetchAthlete()} />
      </div>
    );
  }

  if (!program) {
    return (
      <div className="flex flex-col h-full overflow-y-auto safe-top">
        <MinimalTopBar onBack={() => navigate(-1)} navigate={navigate} />
        <ProgramOnboarding onGenerated={() => refetch()} />
      </div>
    );
  }

  return (
    <CoachShell
      session={session}
      program={program}
      logs={logs}
      currentWeek={currentWeek}
      todayDayIndex={todayDayIndex}
      refetch={refetch}
      navigate={navigate}
    />
  );
};

// ── Top bar — kept ultra-minimal so Coach feels native, not isolated ───────────
const MinimalTopBar = ({ onBack, navigate }: { onBack: () => void; navigate: any }) => (
  <div className="shrink-0 px-4 pt-3 pb-2 flex items-center justify-between">
    <Button variant="ghost" size="icon-sm" onClick={onBack} aria-label="Back">
      <ArrowLeft size={18} />
    </Button>
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon-sm" onClick={() => navigate("/coach/profile")} aria-label="Trainer profile">
        <User size={16} />
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={() => navigate("/coach/memory")} aria-label="Coach memory">
        <Brain size={16} />
      </Button>
    </div>
  </div>
);

const CoachShell = ({ session, program, logs, currentWeek, todayDayIndex, refetch, navigate }: any) => {
  const [chatOpen, setChatOpen] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);

  const askCoach = (q: string) => {
    setPendingPrompt(q);
    setChatOpen(true);
  };

  return (
    <div className="flex flex-col h-full relative">
      <MinimalTopBar onBack={() => navigate(-1)} navigate={navigate} />

      <div className="flex-1 overflow-y-auto px-4 pb-32">
        {/* The trainer speaks first */}
        <TrainerBrief onAsk={askCoach} />

        {/* Today's session — the prescription */}
        <TodaySessionCard
          program={program}
          currentWeek={currentWeek}
          todayDayIndex={todayDayIndex}
          logs={logs}
          onLogged={() => refetch()}
        />

        {/* Week at a glance */}
        <div className="mt-4">
          <WeekStrip
            program={program}
            currentWeek={currentWeek}
            todayDayIndex={todayDayIndex}
            logs={logs}
          />
        </div>

        {/* Daily focus — single column, lighter chrome */}
        <SectionLabel>Daily focus</SectionLabel>
        <div className="space-y-2.5">
          <DailyMissionCard />
          <EveningReflectionCard />
          <GoalTrackerCard />
          <HabitsTab />
        </div>

        {/* The plan, inline */}
        <SectionLabel>Your plan</SectionLabel>
        <ProgramWeekAccordion program={program} currentWeek={currentWeek} logs={logs} />

        {/* Progress, inline */}
        <SectionLabel>Progress</SectionLabel>
        <div className="space-y-3">
          <PerformanceOSDashboard />
          <ProgressDashboard program={program} currentWeek={currentWeek} logs={logs} />
        </div>
      </div>

      {/* Persistent composer — the trainer is always one tap away */}
      <PersistentComposer onOpen={(prompt) => { setPendingPrompt(prompt ?? null); setChatOpen(true); }} />

      <AnimatePresence>
        {chatOpen && (
          <ChatSheet
            session={session}
            program={program}
            initialPrompt={pendingPrompt}
            onClose={() => { setChatOpen(false); setPendingPrompt(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground/70 mt-6 mb-2 px-1">
    {children}
  </p>
);

// ── Persistent composer pinned above BottomNav ────────────────────────────────
const PersistentComposer = ({ onOpen }: { onOpen: (prompt?: string) => void }) => {
  const [draft, setDraft] = useState("");
  return (
    <div
      className="absolute left-0 right-0 bottom-0 z-20"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div
        className="px-3 pt-2 pb-2"
        style={{
          background: "linear-gradient(180deg, transparent 0%, hsl(var(--background)/0.92) 30%, hsl(var(--background)) 100%)",
        }}
      >
        <div className="flex items-center gap-2 rounded-full border border-gold/30 bg-card/85 backdrop-blur-xl pl-4 pr-1.5 py-1.5 shadow-[0_8px_24px_-12px_hsl(42_78%_54%/0.5)]">
          <Sparkles size={14} className="text-gold shrink-0" />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={(e) => { e.currentTarget.blur(); onOpen(draft || undefined); }}
            placeholder="Ask your coach…"
            className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground/60 focus:outline-none min-w-0"
          />
          <button
            type="button"
            onClick={() => { hapticImpact("light"); onOpen(draft || undefined); setDraft(""); }}
            aria-label="Open coach"
            className="h-9 w-9 rounded-full bg-gradient-to-b from-[hsl(42_88%_62%)] to-[hsl(42_78%_48%)] text-[hsl(260_18%_4%)] flex items-center justify-center shadow-[0_4px_12px_-2px_hsl(42_78%_54%/0.55)] active:scale-95 transition shrink-0"
          >
            <Send size={14} strokeWidth={2.6} />
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Chat sheet (slide-up over content) ────────────────────────────────────────
type ChatMsg = Msg & { faq_id?: string; failed?: boolean; isFaq?: boolean };

const STALE_MS = 24 * 60 * 60 * 1000;
const HISTORY_TS_KEY = "w_coach_messages_v1_ts";

const ChatSheet = ({
  session, program, initialPrompt, onClose,
}: { session: any; program: any; initialPrompt: string | null; onClose: () => void }) => {
  const [messages, setMessages] = useState<ChatMsg[]>(() => {
    try {
      const ts = Number(localStorage.getItem(HISTORY_TS_KEY) ?? 0);
      if (Date.now() - ts > STALE_MS) return [];
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as ChatMsg[];
    } catch {}
    return [];
  });
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [showBrowser, setShowBrowser] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sentInitialRef = useRef(false);
  const lastFaqRef = useRef<FaqEntry | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40)));
      localStorage.setItem(HISTORY_TS_KEY, String(Date.now()));
    } catch {}
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }, [messages, streaming]);

  const newChat = () => {
    hapticImpact("light");
    setMessages([]);
    lastFaqRef.current = null;
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  /** Send a FAQ entry instantly — no network. */
  const sendFaq = (entry: FaqEntry) => {
    hapticImpact("light");
    lastFaqRef.current = entry;
    setMessages((prev) => [
      ...prev,
      { role: "user", content: entry.question },
      { role: "assistant", content: entry.answer_md, faq_id: entry.id, isFaq: true },
    ]);
  };

  const callAi = async (history: ChatMsg[]) => {
    setStreaming(true);
    let buf = "";
    const upsert = (chunk: string) => {
      buf += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && !last.isFaq) {
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
          messages: history.map(({ role, content }) => ({ role, content })),
          program_context: program ? { goal: program.goal, summary: program.ai_summary } : null,
          faq_context: lastFaqRef.current
            ? { question: lastFaqRef.current.question, answer: lastFaqRef.current.answer_md }
            : null,
        }),
      });
      if (!resp.ok || !resp.body) {
        if (resp.status === 429) toast.error("Coach is busy. Try again in a moment.");
        else if (resp.status === 402) toast.error("AI credits exhausted.");
        else toast.error("Coach failed to respond.");
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Coach lost connection. Tap to retry.", failed: true },
        ]);
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
      if (e?.name !== "AbortError") {
        toast.error("Connection lost.");
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Coach lost connection. Tap to retry.", failed: true },
        ]);
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
      try {
        if (buf && buf.length > 20 && session?.access_token) {
          const finalMsgs = [...history, { role: "assistant" as const, content: buf }];
          supabase.functions.invoke("coach-extract-memory", {
            body: { messages: finalMsgs.slice(-6) },
          }).catch(() => { /* silent */ });
        }
      } catch { /* silent */ }
    }
  };

  const send = async (textOverride?: string, opts?: { faqId?: string }) => {
    const text = (textOverride ?? input).trim();
    if (!text || streaming) return;

    // Instant FAQ path
    const faq = matchFaq(text, opts?.faqId);
    if (faq) {
      setInput("");
      sendFaq(faq);
      return;
    }

    hapticImpact("light");
    setInput("");
    const userMsg: ChatMsg = { role: "user", content: text };
    const next = [...messages.filter((m) => !m.failed), userMsg];
    setMessages(next);
    await callAi(next);
  };

  const retryLast = async () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    setMessages((prev) => prev.filter((m) => !m.failed));
    await callAi(messages.filter((m) => !m.failed));
  };

  // Auto-send initial prompt
  useEffect(() => {
    if (!sentInitialRef.current && initialPrompt && initialPrompt.trim()) {
      sentInitialRef.current = true;
      send(initialPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  const quickAnswers = COACH_FAQ.slice(0, 6);

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 32, stiffness: 320 }}
      className="absolute inset-0 z-40 bg-background flex flex-col"
    >
      <div className="shrink-0 px-3 pt-3 pb-2 flex items-center justify-between border-b border-border/30 bg-background/85 backdrop-blur-xl">
        <Button variant="ghost" size="icon-sm" onClick={newChat} aria-label="New chat" title="New chat">
          <Plus size={18} />
        </Button>
        <div className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-gold shadow-[0_0_8px_hsl(var(--gold))]" />
          <p className="font-display text-sm font-black tracking-tight">W Coach</p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
          <X size={18} />
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center pt-4 pb-2">
            <p className="text-xs text-muted-foreground max-w-[280px] mx-auto mb-4">
              Ask anything. Coach knows your program, last 7 days, and the playbook below.
            </p>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gold/80 mb-2">
              Quick answers
            </p>
            <div className="flex flex-col gap-2 max-w-sm mx-auto">
              {quickAnswers.map((f) => (
                <button
                  key={f.id}
                  onClick={() => send(f.question, { faqId: f.id })}
                  className="text-left rounded-xl border border-gold/20 bg-gold/[0.04] hover:bg-gold/[0.1] hover:border-gold/40 px-3.5 py-2.5 text-sm transition"
                >
                  {f.question}
                </button>
              ))}
              <button
                onClick={() => { hapticImpact("light"); setShowBrowser(true); }}
                className="mt-1 inline-flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-gold transition"
              >
                <BookOpen size={12} /> Browse playbook
              </button>
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
              className={m.role === "user" ? "flex justify-end" : "flex flex-col items-start"}
            >
              <div className={m.role === "user"
                ? "max-w-[82%] rounded-2xl rounded-br-md px-3.5 py-2.5 bg-gold text-primary-foreground text-sm whitespace-pre-wrap"
                : `max-w-[88%] rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm prose prose-invert prose-sm max-w-none prose-p:my-1.5 prose-strong:text-foreground ${
                    m.failed
                      ? "bg-destructive/10 border border-destructive/30 cursor-pointer"
                      : m.isFaq
                        ? "bg-gold/[0.06] border border-gold/25"
                        : "bg-card/70 border border-border/40"
                  }`
              }
              onClick={m.failed ? retryLast : undefined}
              >
                {m.role === "assistant" ? <ReactMarkdown>{m.content || "…"}</ReactMarkdown> : m.content}
                {m.failed && (
                  <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-destructive font-bold">
                    <RotateCw size={11} /> Tap to retry
                  </div>
                )}
              </div>
              {m.isFaq && m.role === "assistant" && (
                <p className="mt-1 ml-1 text-[10px] text-muted-foreground/70">
                  From Coach Playbook · Ask a follow-up for more
                </p>
              )}
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

      <div
        className="shrink-0 border-t border-border/30 bg-background/85 backdrop-blur-xl px-3 pt-3 pb-3"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 12px)" }}
      >
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
            autoFocus
          />
          <Button variant="ember" size="icon-lg" loading={streaming} disabled={!input.trim()}
            onClick={() => send()} className="shrink-0 rounded-2xl" aria-label="Send">
            <Send size={16} />
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {showBrowser && (
          <FaqBrowser
            onClose={() => setShowBrowser(false)}
            onSelect={(f) => { setShowBrowser(false); send(f.question, { faqId: f.id }); }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Coach;
