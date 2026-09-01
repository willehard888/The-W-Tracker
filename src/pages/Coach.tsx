import { memo, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Send, ArrowLeft, X, BookOpen, RotateCw, Plus, Sparkles, MoreVertical, User, Brain } from "lucide-react";
import { matchFaq, COACH_FAQ, FaqEntry } from "@/lib/coach-faq";
import FaqBrowser from "@/components/coach/FaqBrowser";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { hapticImpact } from "@/lib/haptics";
import { withNetworkRetry } from "@/lib/retry";
import { toast } from "sonner";
import { useCoachProgram } from "@/hooks/use-coach-program";
import { CoachSkeleton as PageSkeleton } from "@/components/skeletons/PageSkeleton";
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
    logs,
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

  if (loading) return <PageSkeleton />;
  if (isLoading || athleteLoading) return <PageSkeleton />;

  // Surface real backend errors instead of looping the skeleton or silently
  // pushing users into the onboarding flow when the underlying table isn't
  // present. Most common cause: the Supabase migrations for coach_athlete_profile
  // / coach_programs haven't been applied to the user's project yet. Show the
  // actual error message so the dev / user knows exactly what to fix.
  if (athleteError || programError) {
    const err = (athleteError ?? programError)!;
    // Keep the technical cause for debugging, but never show DB/migration
    // internals to a paying user — surface a calm, recoverable message.
    if (typeof console !== "undefined") console.error("W Coach failed to load:", err);
    return (
      <div className="flex flex-col h-full">
        <CoachHeader onBack={() => navigate(-1)} navigate={navigate} />
        <div className="flex-1 flex items-center justify-center px-6 text-center">
          <div className="max-w-sm space-y-4">
            <div className="text-3xl" aria-hidden>⚠️</div>
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
      <div className="flex flex-col h-full">
        <CoachHeader onBack={() => navigate(-1)} navigate={navigate} />
        <div className="w-full flex justify-end px-6 pt-2">
          <button
            onClick={skipOnboarding}
            className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1"
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
      navigate={navigate}
    />
  );
};

// ── Standard W page header (matches /profile, /leaderboard, /checkin) ──────────
// Replaces the previous bespoke topbar with three competing icons. The user
// fed back that opening /coach felt like switching apps; making the header
// match every other W destination is half the fix. Trainer-profile + memory
// links live one tap deeper inside a small dropdown menu rather than fighting
// for header real-estate alongside the back arrow.
const CoachHeader = ({ onBack, navigate }: { onBack: () => void; navigate: any }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="shrink-0 px-4 pt-3 pb-2 flex items-center justify-between border-b border-border/30 relative">
      <Button variant="ghost" size="icon-sm" onClick={onBack} aria-label="Back">
        <ArrowLeft size={18} />
      </Button>
      <div className="text-center">
        <h1 className="font-display text-base font-black tracking-tight">W Coach</h1>
        <p className="text-[10px] leading-tight text-muted-foreground">AI coach · not a medical professional</p>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label="Coach settings"
      >
        <MoreVertical size={16} />
      </Button>
      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setMenuOpen(false)}
            aria-hidden
          />
          <div className="absolute right-3 top-12 z-40 w-48 surface-glass rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => { setMenuOpen(false); navigate("/coach/profile"); }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-sm hover:bg-card/60 active:bg-card/40 active:scale-[0.98] transition"
            >
              <User size={14} className="text-gold" />
              <span>Trainer profile</span>
            </button>
            <button
              type="button"
              onClick={() => { setMenuOpen(false); navigate("/coach/memory"); }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-sm hover:bg-card/60 active:bg-card/40 active:scale-[0.98] transition border-t border-border/40"
            >
              <Brain size={14} className="text-gold" />
              <span>Coach memory</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

const CoachShell = ({ session, program, navigate }: any) => {
  const [searchParams, setSearchParams] = useSearchParams();
  // ?seed=<the day's coach feedback> → open chat with it as the opening
  // assistant bubble so the user can continue that exact conversation.
  const seedRef = useRef<string | null>(searchParams.get("seed"));
  const [seedAssistant] = useState<string | null>(() => seedRef.current);
  const [chatOpen, setChatOpen] = useState(!!seedRef.current);
  const [chatPrompt, setChatPrompt] = useState<string | null>(null);

  // Strip ?seed once consumed so a refresh doesn't re-seed the chat.
  useEffect(() => {
    if (seedRef.current) {
      searchParams.delete("seed");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // AI-first landing. W Coach SPEAKS FIRST (CoachBriefHero) — a proactive,
  // data-aware brief — then offers the live chat and the supporting cards.
  // The whole app is paywalled, so the AI coach is available to every member;
  // there's no secondary Elite gate on the conversation any more.
  const openChat = (prompt?: string) => {
    hapticImpact("light");
    setChatPrompt(prompt ?? null);
    setChatOpen(true);
  };

  return (
    <div className="flex flex-col h-full relative">
      <CoachHeader onBack={() => navigate(-1)} navigate={navigate} />

      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-8 space-y-3">
        {/* The AI leads — proactive daily brief, the centre of the experience. */}
        <CoachBriefHero onOpenChat={() => openChat()} onAsk={(q) => openChat(q)} />
        {/* The adaptive daily plan — readiness + missions, the coach's real
            "what to do today" engine (replaces the rule-based MoveCard). */}
        <TodaysPlanCard />
        <StateCard onAsk={(q) => openChat(q)} />
        <ProgramCard />
        <HealthKitConnectCard />
        <CoachFooterLinks />
      </div>

      <AnimatePresence>
        {chatOpen && (
          <ChatSheet
            session={session}
            program={program}
            initialPrompt={chatPrompt}
            seedAssistant={seedAssistant}
            onClose={() => { setChatOpen(false); setChatPrompt(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Chat sheet (slide-up over content) ────────────────────────────────────────
// (PersistentComposer removed — it was a fixed input bar pinned above
// BottomNav that gave /coach a sub-app feel no other W page has. Chat is
// now reached via the inline "Ask your coach" card at the bottom of the
// scroll, matching every other W destination's CTA pattern.)
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

/** Memoized markdown for COMPLETED assistant messages — parsing markdown on
 *  every SSE delta of every message made long chats visibly stutter. The
 *  actively-streaming message renders as plain text (see below) and only
 *  goes through markdown once, on completion. */
const CoachMarkdown = memo(({ content }: { content: string }) => (
  <ReactMarkdown>{content || "…"}</ReactMarkdown>
));

/** Premium "coach is thinking" indicator — three staggered gold dots.
 *  gpt-5 reasons before it speaks; this makes that phase feel deliberate
 *  instead of broken. CSS-only (animate-pulse), reduced-motion safe. */
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
  session, program, initialPrompt, seedAssistant, onClose,
}: { session: any; program: any; initialPrompt: string | null; seedAssistant?: string | null; onClose: () => void }) => {
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sentInitialRef = useRef(false);
  const lastFaqRef = useRef<FaqEntry | null>(null);

  // Pre-chat mood snapshot — surfaces above the composer when there's no
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

  // Kill an in-flight stream when the sheet closes/unmounts — the request
  // used to keep running (and setting state) against an unmounted tree.
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

  // Auto-send initial prompt
  useEffect(() => {
    if (!sentInitialRef.current && initialPrompt && initialPrompt.trim()) {
      sentInitialRef.current = true;
      send(initialPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  const quickAnswers = COACH_FAQ.slice(0, 4);
  // Conversational starters — real model round-trips (no faqId) so the empty
  // state teaches "you can TALK to this coach", not just request briefings.
  const conversationStarters = ["Mitä kuuluu?", "Miten tänään kannattaa treenata?"];

  return (
    <>
      {/* Backdrop — dimmed but not opaque so the user sees today's Coach
          context (session card, missions) sitting BEHIND the chat. This
          is the "you're still inside the same page" cue. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="absolute inset-0 z-30 bg-black/55"
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer — slides up to 85% of viewport, rounded top, drag handle.
          Replaces the previous full-screen modal that hid all parent
          context (one of the main reasons opening /coach felt like a
          separate app). */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 32, stiffness: 320 }}
        className="absolute inset-x-0 bottom-0 z-40 max-h-[85vh] flex flex-col bg-background rounded-t-3xl shadow-[0_-20px_60px_-12px_hsl(var(--background)/0.8)] border-t border-gold/25"
      >
        {/* Drag handle — visual idiom matching the W onboarding sheets. */}
        <div className="shrink-0 flex items-center justify-center pt-2 pb-1">
          <span className="h-1 w-9 rounded-full bg-foreground/20" aria-hidden />
        </div>

      <div className="shrink-0 px-3 pt-1 pb-2 flex items-center justify-between border-b border-border/30 bg-background/97">
        <Button variant="ghost" size="icon-sm" onClick={newChat} aria-label="New chat" title="New chat">
          <Plus size={18} />
        </Button>
        <div className="text-center">
          <div className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-gold shadow-[0_0_8px_hsl(var(--gold))]" />
            <p className="font-display text-sm font-black tracking-tight">W Coach</p>
          </div>
          <p className="text-[10px] leading-tight text-muted-foreground">AI coach · not a medical professional</p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
          <X size={18} />
        </Button>
      </div>

      {showMoodSnapshot && (
        <MoodSnapshot
          onCaptured={(snap) => { setMoodSnapshot(snap); setMoodCardDismissed(true); }}
          onSkip={() => setMoodCardDismissed(true)}
        />
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center pt-4 pb-2">
            <p className="text-xs text-muted-foreground max-w-[280px] mx-auto mb-4">
              Ask anything. Coach knows your program, last 7 days, and the playbook below.
            </p>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-gold/80 mb-2">
              Quick answers
            </p>
            <div className="flex flex-col gap-2 max-w-sm mx-auto">
              {conversationStarters.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="text-left rounded-xl border border-gold/20 bg-gold/[0.04] hover:bg-gold/[0.1] hover:border-gold/40 px-3.5 py-2.5 text-sm transition"
                >
                  {q}
                </button>
              ))}
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
                className="mt-1 inline-flex items-center justify-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-muted-foreground hover:text-gold transition"
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
                        : "surface-panel border-border/40"
                  }`
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
                <p className="mt-1 ml-1 text-[11px] text-muted-foreground/70">
                  From Coach Playbook · Ask a follow-up for more
                </p>
              )}
              {m.role === "assistant" && !m.failed && !m.isFaq && !streaming && i === messages.length - 1 && m.content.length > 60 && (
                <button
                  type="button"
                  onClick={goDeeper}
                  className="mt-1.5 ml-1 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-gold/85 hover:text-gold transition"
                >
                  <Sparkles size={12} /> Go deeper
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        {streaming && messages[messages.length - 1]?.role === "user" && <ThinkingIndicator />}

        {/* Seeded from today's feedback — one-tap follow-ups on improving. */}
        {seedChipsShown && !streaming && (
          <div className="flex flex-col gap-2 max-w-sm pt-1">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-xp-green/80">
              Ask a follow-up
            </p>
            {PERFORMANCE_FOLLOWUPS.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                className="text-left rounded-xl border border-xp-green/25 bg-xp-green/[0.05] hover:bg-xp-green/[0.12] hover:border-xp-green/45 px-3.5 py-2.5 text-sm transition"
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        className="shrink-0 border-t border-border/30 bg-background/97 px-3 pt-3 pb-3"
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
            className="flex-1 resize-none surface-inset rounded-2xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-gold/60 focus:ring-1 focus:ring-gold/30 max-h-32 disabled:opacity-60"
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
    </>
  );
};

export default Coach;
