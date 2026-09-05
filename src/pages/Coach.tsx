import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { memo, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams, type NavigateFunction } from "react-router-dom";
import { Send, BookOpen, RotateCw, Plus, Sparkles, MoreVertical, User, Brain, AlertTriangle } from "lucide-react";
import { matchFaq, COACH_FAQ, FaqEntry } from "@/lib/coach-faq";
import FaqBrowser from "@/components/coach/FaqBrowser";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PageBar from "@/components/ui/page-bar";
import { BottomSheet } from "@/components/ui/sheet-bottom";
import { cn } from "@/lib/utils";
import { hapticImpact } from "@/lib/haptics";
import { withNetworkRetry } from "@/lib/retry";
import { toast } from "sonner";
import { useCoachProgram, todaySessionOf, type CoachProgram } from "@/hooks/use-coach-program";
import { useDailyPlan } from "@/hooks/use-daily-plan";
import { Block } from "@/components/skeletons/PageSkeleton";
import AthleteProfileOnboarding from "@/components/coach/AthleteProfileOnboarding";
import MoodSnapshot from "@/components/coach/MoodSnapshot";
import { useAthleteProfile } from "@/hooks/use-athlete-profile";
import { useTodayReflection } from "@/hooks/use-coach-reflection";
import { supabase } from "@/integrations/supabase/client";
import StateCard from "@/components/coach/v2/StateCard";
import TodaysPlanCard from "@/components/coach/TodaysPlanCard";
import ProgramCard from "@/components/coach/v2/ProgramCard";
import CoachBriefHero from "@/components/coach/v2/CoachBriefHero";
import CoachFooterLinks from "@/components/coach/v2/CoachFooterLinks";
import HealthKitConnectCard from "@/components/health/HealthKitConnectCard";
import { useOnboardingTrigger } from "@/components/onboarding/onboarding-context";

type Msg = { role: "user" | "assistant"; content: string };
const STORAGE_KEY = "w_coach_messages_v1";
const DISCLAIMER = "AI coach · not a medical professional";

/** Mirrors the redesigned Coach: the bar, the beat, the brief hero, the plan,
 *  then quiet rows. (CoachSkeleton in PageSkeleton.tsx is the route fallback.) */
const CoachPageSkeleton = () => (
  <div className="animate-fade-in">
    <div className="h-11 safe-top" />
    <div className="px-4 pt-3 pb-6">
      <Block height={28} className="w-3/4 !rounded-lg" />
      <Block height={12} delay={40} className="w-44 mt-2 !rounded-md" />
      <Block height={236} delay={80} className="mt-4 !rounded-3xl" />
      <Block height={168} delay={140} className="mt-3" />
      <Block height={96} delay={200} className="mt-3" />
      <Block height={64} delay={260} className="mt-3" />
    </div>
  </div>
);

const Coach = () => {
  // Contextual onboarding: first /coach mount → the AI-transparency intro
  // sheet (AI-powered, never a medical substitute) BEFORE anything else.
  useOnboardingTrigger("AI_COACH_INTRO", true);
  // FIX (migration 20260511 commit): the page previously read `isPremium`
  // and `subscriptionLoading` from useAuth(), but AuthContext exports
  // `isElite` and `loading`. Reading missing fields meant `!isPremium` was
  // always truthy and EVERY user saw the upsell — including paying Elite
  // users. The correct names are used now.
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  // Seeded from the day's coach feedback → go straight to the chat shell; a
  // user who tapped "ask the coach about today" shouldn't hit the profile wall.
  // Frozen at mount: CoachShell strips the ?seed param, and re-reading it live
  // would flip this false and bounce the user back into onboarding.
  const [hasSeed] = useState(() => {
    try { return !!new URLSearchParams(window.location.search).get("seed"); } catch { return false; }
  });
  const {
    isLoading,
    error: programError,
    program,
    currentWeek,
    todayDayIndex,
    refetch,
  } = useCoachProgram();
  const {
    profile: athlete,
    isLoading: athleteLoading,
    error: athleteError,
    refetch: refetchAthlete,
  } = useAthleteProfile();

  // C3: a user who declines the athlete-profile form must NOT be re-walled on
  // every Coach visit. Persist the skip so they land in the Coach shell (Lite
  // experience) thereafter; they can still complete the profile later for a
  // richer plan. Cleared automatically once they actually onboard.
  const [onboardSkipped, setOnboardSkipped] = useState(() => {
    try { return localStorage.getItem("w_coach_onboard_skipped") === "1"; } catch { return false; }
  });
  const skipOnboarding = () => {
    try { localStorage.setItem("w_coach_onboard_skipped", "1"); } catch {}
    setOnboardSkipped(true);
  };

  if (loading || isLoading || athleteLoading) return <CoachPageSkeleton />;

  // Surface real backend errors instead of looping the skeleton or silently
  // pushing users into the onboarding flow when the underlying table isn't
  // present. Most common cause: the Supabase migrations for coach_athlete_profile
  // / coach_programs haven't been applied to the user's project yet. Show the
  // actual error message so the dev / user knows exactly what to fix.
  if (athleteError || programError) {
    const err = (athleteError ?? programError)!;
    // Keep the technical cause for debugging, but never show DB/migration
    // internals to a paying user — surface a calm, recoverable message.
    if (typeof console !== "undefined") console.error("AI Coach failed to load:", err);
    return (
      <div className="min-h-full">
        <PageBar title="AI Coach" onBack={() => navigate(-1)} action={<CoachMenu navigate={navigate} />} />
        <div className="home-rise px-6 pt-16 pb-6 text-center">
          <div className="max-w-sm mx-auto space-y-4">
            <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center mx-auto" aria-hidden><AlertTriangle size={32} className="text-muted-foreground" /></div>
            <h2 className="text-lg font-display font-bold">Coach is taking a breather</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We couldn't load your Coach just now. Check your connection and try
              again — your progress is safe.
            </p>
            <Button onClick={() => { refetch(); refetchAthlete(); }} className="w-full">
              <RotateCw size={14} className="mr-2" /> Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // The profile drives plan quality, so we prompt for it — but it's optional.
  // If the user hasn't onboarded AND hasn't already skipped, show the form with
  // an explicit "Skip for now" escape so they're never trapped at the wall.
  if (!athlete?.onboarded && !onboardSkipped && !hasSeed) {
    return (
      <div className="min-h-full">
        <PageBar title="AI Coach" onBack={() => navigate(-1)} action={<CoachMenu navigate={navigate} />} />
        <div className="w-full flex justify-end px-6 pt-2">
          <button
            type="button"
            onClick={skipOnboarding}
            className="press min-h-11 text-xs font-medium text-muted-foreground px-3"
            aria-label="Skip personalisation for now"
          >
            Skip for now
          </button>
        </div>
        <AthleteProfileOnboarding onDone={() => refetchAthlete()} />
      </div>
    );
  }

  // NOTE: we used to hard-redirect Elite users without a program straight to
  // ProgramOnboarding here. That hid the whole Coach shell — including the
  // "Ask Coach" chat — behind a program that requires an AI call to create, so
  // if generation failed the user was stranded with no chat. The shell now
  // always renders; ProgramCard surfaces the "Build my program" CTA inline
  // (→ /coach/program → ProgramOnboarding) for users without one yet.
  return (
    <CoachShell
      session={session}
      program={program}
      currentWeek={currentWeek}
      todayDayIndex={todayDayIndex}
      navigate={navigate}
    />
  );
};

// The PageBar's one action: trainer-profile + memory links live one tap deeper
// inside a small menu rather than fighting for bar real-estate.
const CoachMenu = ({ navigate }: { navigate: NavigateFunction }) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" aria-label="Coach settings">
        <MoreVertical size={16} aria-hidden />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-48">
      <DropdownMenuItem onClick={() => navigate("/coach/profile")}>
        <User size={14} className="mr-2 text-gold" aria-hidden /> Trainer profile
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => navigate("/coach/memory")}>
        <Brain size={14} className="mr-2 text-gold" aria-hidden /> Coach memory
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

type Session = ReturnType<typeof useAuth>["session"];

const CoachShell = ({
  session, program, currentWeek, todayDayIndex, navigate,
}: {
  session: Session;
  program: CoachProgram | null;
  currentWeek: number;
  todayDayIndex: number;
  navigate: NavigateFunction;
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  // ?seed=<the day's coach feedback> → open chat with it as the opening
  // assistant bubble so the user can continue that exact conversation.
  const seedRef = useRef<string | null>(searchParams.get("seed"));
  const [seedAssistant] = useState<string | null>(() => seedRef.current);
  const [chatOpen, setChatOpen] = useState(!!seedRef.current);
  const [chatPrompt, setChatPrompt] = useState<string | null>(null);
  // The page's single daily-plan subscription: the hero shows its readiness
  // number, the plan card its missions. (Two calls would open two channels.)
  const daily = useDailyPlan();

  // Strip ?seed once consumed so a refresh doesn't re-seed the chat.
  useEffect(() => {
    if (seedRef.current) {
      searchParams.delete("seed");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // AI-first landing. AI Coach SPEAKS FIRST (CoachBriefHero) — a proactive,
  // data-aware brief — then offers the live chat and the supporting rows.
  // Access control lives in the app-wide paywall gate (ProtectedRoute) plus
  // the edge function's own has_active_access check (403 → /paywall below).
  const openChat = (prompt?: string) => {
    hapticImpact("light");
    setChatPrompt(prompt ?? null);
    setChatOpen(true);
  };

  // Opening beat: the week and today's session, or the invitation.
  const today = todaySessionOf(program, currentWeek, todayDayIndex);
  const beat = !program
    ? "Tell me the goal. I build the week."
    : `Week ${currentWeek}. ${!today ? "Your week is set" : today.isRest ? "Rest day" : today.focus}.`;

  return (
    <div className="min-h-full">
      <PageBar title="AI Coach" onBack={() => navigate(-1)} action={<CoachMenu navigate={navigate} />} />

      <div className="px-4 pt-3 pb-6">
        <header className="home-rise">
          <h1 className="font-display font-black text-[27px] leading-[1.04] tracking-tight">{beat}</h1>
          <p className="mt-1.5 text-[11px] text-muted-foreground">{DISCLAIMER}</p>
        </header>

        {/* HERO: the coach's words and the gold readiness number. */}
        <div className="home-rise home-rise-1 mt-4">
          <CoachBriefHero
            readiness={daily.plan?.readiness_score ?? null}
            onOpenChat={() => openChat()}
            onAsk={(q) => openChat(q)}
          />
        </div>

        {/* THE PLAN: push/hold/deload and the missions you tick. */}
        <div className="home-rise home-rise-2 mt-3">
          <TodaysPlanCard daily={daily} />
        </div>

        {/* SUPPORT: your read, the program door, Apple Health. Quiet rows. */}
        <div className="home-rise home-rise-3 mt-3">
          <StateCard onAsk={(q) => openChat(q)} />
        </div>
        <div className="home-rise home-rise-4 mt-3">
          <ProgramCard />
        </div>
        <div className="home-rise home-rise-4 mt-3 empty:hidden">
          <HealthKitConnectCard />
        </div>

        {/* DOORS: type only. */}
        <div className="home-rise home-rise-5 mt-5">
          <CoachFooterLinks />
        </div>
      </div>

      <ChatSheet
        open={chatOpen}
        session={session}
        program={program}
        initialPrompt={chatPrompt}
        seedAssistant={seedAssistant}
        onClose={() => { setChatOpen(false); setChatPrompt(null); }}
      />
    </div>
  );
};

// ── Chat sheet ────────────────────────────────────────────────────────────────
// The app-wide BottomSheet, mounted for the page's whole life and driven by
// `open`, so the thread survives close/reopen and the sheet's exit plays.
type ChatMsg = Msg & { faq_id?: string; failed?: boolean; isFaq?: boolean };

// 7 days: the coach should remember the week's thread — extracted memory
// facts carry everything older. (Was 24h, which made every morning start
// from a blank amnesiac chat.)
const STALE_MS = 7 * 24 * 60 * 60 * 1000;
const HISTORY_TS_KEY = "w_coach_messages_v1_ts";

// Follow-up chips shown when the chat is seeded from the day's coach feedback.
// ai-coach already has today's check-in + brief in its system prompt, so these
// answer with real, grounded advice.
const PERFORMANCE_FOLLOWUPS = [
  "How do I improve tomorrow?",
  "Why was my output low today?",
  "What should I prioritize next?",
];

/** A quick answer: one quiet row. */
const CHIP = "press w-full min-h-11 surface-card surface-card-quiet px-3.5 py-2.5 text-left text-sm";

/** Memoized markdown for COMPLETED assistant messages — parsing markdown on
 *  every SSE delta of every message made long chats visibly stutter. The
 *  actively-streaming message renders as plain text (see below) and only
 *  goes through markdown once, on completion. */
const CoachMarkdown = memo(({ content }: { content: string }) => (
  <ReactMarkdown>{content || "…"}</ReactMarkdown>
));

/** "Coach is thinking" — three staggered gold dots. gpt-5 reasons before it
 *  speaks; this makes that phase feel deliberate instead of broken.
 *  CSS-only (animate-pulse), reduced-motion safe. */
const ThinkingIndicator = () => (
  <div className="flex justify-start">
    <div className="surface-panel rounded-2xl rounded-bl-md px-3.5 py-2.5 flex items-center gap-2">
      <span className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-gold animate-pulse"
            style={{ animationDelay: `${i * 220}ms`, animationDuration: "1.1s" }}
          />
        ))}
      </span>
      <span className="text-[12px] font-bold text-muted-foreground">Coach is thinking…</span>
    </div>
  </div>
);

const ChatSheet = ({
  open, session, program, initialPrompt, seedAssistant, onClose,
}: {
  open: boolean;
  session: Session;
  program: CoachProgram | null;
  initialPrompt: string | null;
  seedAssistant?: string | null;
  onClose: () => void;
}) => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMsg[]>(() => {
    // Load the saved thread first; a check-in seed APPENDS as the latest
    // coach bubble. (It used to replace the whole thread — and the persist
    // effect then overwrote a week of saved history with that one line.)
    let prior: ChatMsg[] = [];
    try {
      const ts = Number(localStorage.getItem(HISTORY_TS_KEY) ?? 0);
      if (Date.now() - ts <= STALE_MS) {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) prior = JSON.parse(raw) as ChatMsg[];
      }
    } catch {}
    if (seedAssistant && seedAssistant.trim()) {
      return [...prior, { role: "assistant", content: seedAssistant.trim() }];
    }
    return prior;
  });
  // Performance follow-up chips shown until the user asks their first question.
  const [seedChipsShown, setSeedChipsShown] = useState(!!(seedAssistant && seedAssistant.trim()));
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [showBrowser, setShowBrowser] = useState(false);
  // Index of the bubble the user just sent: it gets the commit-pop.
  const [popIdx, setPopIdx] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sentInitialRef = useRef(false);
  const lastFaqRef = useRef<FaqEntry | null>(null);

  // Pre-chat mood snapshot — surfaces above the thread when there's no
  // reflection for today. Captured value rides on every outbound ai-coach
  // call so the persona block adapts to *right now*, not just baseline.
  const { reflection: todayReflection, isLoading: reflLoading } = useTodayReflection();
  const hasTodayReflection = !!todayReflection;
  const [moodSnapshot, setMoodSnapshot] = useState<{ energy: number; mood: number } | null>(null);
  const [moodCardDismissed, setMoodCardDismissed] = useState(false);
  const showMoodSnapshot =
    !reflLoading && !hasTodayReflection && !moodCardDismissed && messages.length === 0;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40)));
      localStorage.setItem(HISTORY_TS_KEY, String(Date.now()));
    } catch {}
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (!el) return;
      // Respect the reader: only follow the stream when they're already near
      // the bottom (reading along). "auto" during streaming — a smooth-scroll
      // animation retriggered per token janks; smooth only on discrete sends.
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
      if (nearBottom) {
        el.scrollTo({ top: el.scrollHeight, behavior: streaming ? "auto" : "smooth" });
      }
    });
  }, [messages, streaming]);

  // Opening the sheet lands on the latest message; closing it kills an
  // in-flight stream (as unmounting used to) and re-arms the one-shot
  // auto-send so the next tapped question sends again.
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; });
      return;
    }
    sentInitialRef.current = false;
    setPopIdx(null);
    abortRef.current?.abort();
  }, [open]);
  useEffect(() => () => abortRef.current?.abort(), []);

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

  const callAi = async (history: ChatMsg[], opts?: { goDeep?: boolean }) => {
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
      // Retry wraps only the connection phase (fetch resolves at headers) —
      // a transient WKWebView "Load failed" reconnects invisibly; once the
      // stream is open there is deliberately no retry.
      const resp = await withNetworkRetry(() => fetch(url, {
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
          go_deep: !!opts?.goDeep,
          faq_context: lastFaqRef.current
            ? { question: lastFaqRef.current.question, answer: lastFaqRef.current.answer_md }
            : null,
          // Forward pre-chat mood snapshot (if captured this session).
          // Edge function falls back to the latest coach_reflection row otherwise.
          mood_today: moodSnapshot,
          // Local tz offset so the coach can judge timing (streak at risk tonight, etc).
          tz_offset: new Date().getTimezoneOffset(),
          // Seeded threads continue straight from today's check-in — tell the
          // model so the opening assistant bubble isn't an unexplained turn.
          source: seedAssistant ? "post_checkin" : undefined,
        }),
      }), 2);
      if (!resp.ok || !resp.body) {
        // Try to parse the structured error payload from ai-coach so we can
        // surface the *actual* upstream error (OpenRouter status + body)
        // on-screen instead of the generic "Coach failed to respond" toast.
        let detail = "";
        try {
          const errBody = await resp.clone().json() as {
            error?: string;
            upstream_status?: number;
            upstream_body?: string;
          };
          detail = [
            errBody.error,
            errBody.upstream_status ? `OpenRouter ${errBody.upstream_status}` : null,
            errBody.upstream_body ? errBody.upstream_body.slice(0, 200) : null,
          ].filter(Boolean).join(" — ");
        } catch {
          /* fall through */
        }
        const summary = detail || `HTTP ${resp.status}`;
        // Technical detail (upstream provider status/body) stays in the console
        // for debugging; the user only ever sees calm, recoverable copy.
        if (typeof console !== "undefined") console.error("Coach request failed:", summary);

        if (resp.status === 403) {
          // Membership gate (has_active_access) — retrying can never succeed;
          // send them to the paywall like TodaysPlanCard does.
          navigate("/paywall");
          return;
        }
        if (resp.status === 429) toast.error("Coach is busy right now. Try again in a moment.");
        else if (resp.status === 402 || resp.status === 401) toast.error("Coach is briefly unavailable. Please try again shortly.");
        else toast.error("Coach couldn't respond.", { action: { label: "Retry", onClick: () => retryLast() } });

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Coach lost connection. Tap to retry.",
            failed: true,
          },
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
    setSeedChipsShown(false); // first question sent — retire the follow-up chips
    const userMsg: ChatMsg = { role: "user", content: text };
    const next = [...messages.filter((m) => !m.failed), userMsg];
    setMessages(next);
    setPopIdx(next.length - 1);
    await callAi(next);
  };

  const retryLast = async () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    setMessages((prev) => prev.filter((m) => !m.failed));
    await callAi(messages.filter((m) => !m.failed));
  };

  const goDeeper = async () => {
    if (streaming) return;
    hapticImpact("light");
    const nudge: ChatMsg = { role: "user", content: "Go deeper — full reasoning, the science, and a concrete 7-day plan." };
    const next = [...messages, nudge];
    setMessages(next);
    await callAi(next, { goDeep: true });
  };

  // Auto-send the tapped question once per open.
  useEffect(() => {
    if (open && !sentInitialRef.current && initialPrompt && initialPrompt.trim()) {
      sentInitialRef.current = true;
      send(initialPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialPrompt]);

  const quickAnswers = COACH_FAQ.slice(0, 4);
  // Conversational starters — real model round-trips (no faqId) so the empty
  // state teaches "you can TALK to this coach", not just request briefings.
  const conversationStarters = ["How am I doing?", "How should I train today?"];

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      label="Ask your coach"
      title="AI Coach"
      subtitle={DISCLAIMER}
      height="tall"
      leading={
        <Button variant="ghost" size="icon" onClick={newChat} aria-label="New chat" title="New chat">
          <Plus size={18} />
        </Button>
      }
      headerExtra={showMoodSnapshot ? (
        <MoodSnapshot
          onCaptured={(snap) => { setMoodSnapshot(snap); setMoodCardDismissed(true); }}
          onSkip={() => setMoodCardDismissed(true)}
        />
      ) : undefined}
      bodyRef={scrollRef}
      bodyClassName="py-3 space-y-3"
      footer={
        <div className="flex items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); send(); } }}
            placeholder="Ask your coach…"
            enterKeyHint="send"
            disabled={streaming}
            className="h-11 rounded-xl"
            autoFocus
          />
          <Button
            variant="ember"
            size="icon"
            loading={streaming}
            disabled={!input.trim()}
            onClick={() => send()}
            className="h-11 w-11 min-h-11 shrink-0 rounded-xl"
            aria-label="Send"
          >
            <Send size={16} />
          </Button>
        </div>
      }
    >
      {messages.length === 0 && (
        <div className="pt-1">
          <p className="text-[12px] text-muted-foreground mb-3">
            Ask anything. Coach knows your program, your last 7 days and the playbook.
          </p>
          <div className="flex flex-col gap-2">
            {conversationStarters.map((q) => (
              <button key={q} type="button" onClick={() => send(q)} className={CHIP}>{q}</button>
            ))}
            {quickAnswers.map((f) => (
              <button key={f.id} type="button" onClick={() => send(f.question, { faqId: f.id })} className={CHIP}>{f.question}</button>
            ))}
            <button
              type="button"
              onClick={() => { hapticImpact("light"); setShowBrowser(true); }}
              className="press mt-1 min-h-11 inline-flex items-center justify-center gap-1.5 text-[12px] font-semibold text-muted-foreground"
            >
              <BookOpen size={12} aria-hidden /> Browse the playbook
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
            <div
              className={m.role === "user"
                ? cn("max-w-[82%] rounded-2xl rounded-br-md px-3.5 py-2.5 bg-gold text-primary-foreground text-sm whitespace-pre-wrap", i === popIdx && "commit-pop")
                : cn(
                    "max-w-[88%] rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm prose prose-invert prose-sm prose-p:my-1.5 prose-strong:text-foreground",
                    m.failed
                      ? "bg-destructive/10 border border-destructive/30 cursor-pointer"
                      : m.isFaq
                        ? "bg-gold/[0.06] border border-gold/25"
                        : "surface-panel border-border/40",
                  )
              }
              onClick={m.failed ? retryLast : undefined}
            >
              {m.role === "assistant" ? (
                streaming && i === messages.length - 1 && !m.isFaq && !m.failed ? (
                  // Actively streaming: plain text + gold cursor. Markdown
                  // parses ONCE on completion instead of per delta.
                  <span className="whitespace-pre-wrap">
                    {m.content}
                    <span className="inline-block w-[2px] h-[1em] ml-0.5 align-text-bottom bg-gold animate-pulse" aria-hidden />
                  </span>
                ) : (
                  <CoachMarkdown content={m.content} />
                )
              ) : m.content}
              {m.failed && (
                <div className="mt-1.5 inline-flex items-center gap-1 text-[12px] text-destructive font-bold">
                  <RotateCw size={11} /> Tap to retry
                </div>
              )}
            </div>
            {m.isFaq && m.role === "assistant" && (
              <p className="mt-1 ml-1 text-[11px] text-muted-foreground">
                From Coach Playbook · Ask a follow-up for more
              </p>
            )}
            {m.role === "assistant" && !m.failed && !m.isFaq && !streaming && i === messages.length - 1 && m.content.length > 60 && (
              <button
                type="button"
                onClick={goDeeper}
                className="press mt-0.5 ml-1 min-h-11 inline-flex items-center gap-1 text-[12px] font-semibold text-muted-foreground"
              >
                <Sparkles size={12} aria-hidden /> Go deeper
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
      {streaming && messages[messages.length - 1]?.role === "user" && <ThinkingIndicator />}

      {/* Seeded from today's feedback — one-tap follow-ups on improving. */}
      {seedChipsShown && !streaming && (
        <div className="flex flex-col gap-2 pt-1">
          <p className="text-[12px] text-muted-foreground">Ask a follow-up</p>
          {PERFORMANCE_FOLLOWUPS.map((q) => (
            <button key={q} type="button" onClick={() => send(q)} className={CHIP}>{q}</button>
          ))}
        </div>
      )}

      {showBrowser && (
        <FaqBrowser
          onClose={() => setShowBrowser(false)}
          onSelect={(f) => { setShowBrowser(false); send(f.question, { faqId: f.id }); }}
        />
      )}
    </BottomSheet>
  );
};

export default Coach;
