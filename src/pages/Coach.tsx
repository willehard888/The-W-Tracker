import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Send, ArrowLeft, Loader2, X, BookOpen, RotateCw, Plus, Sparkles, MoreVertical, User, Brain } from "lucide-react";
import { matchFaq, COACH_FAQ, FaqEntry } from "@/lib/coach-faq";
import FaqBrowser from "@/components/coach/FaqBrowser";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { hapticImpact } from "@/lib/haptics";
import { toast } from "sonner";
import { useCoachProgram } from "@/hooks/use-coach-program";
import { ProfileSkeleton as PageSkeleton } from "@/components/skeletons/PageSkeleton";
import AthleteProfileOnboarding from "@/components/coach/AthleteProfileOnboarding";
import MoodSnapshot from "@/components/coach/MoodSnapshot";
import { useAthleteProfile } from "@/hooks/use-athlete-profile";
import { useTodayReflection } from "@/hooks/use-coach-reflection";
import { supabase } from "@/integrations/supabase/client";
import StateCard from "@/components/coach/v2/StateCard";
import MoveCard from "@/components/coach/v2/MoveCard";
import ProgramCard from "@/components/coach/v2/ProgramCard";
import CoachBriefHero from "@/components/coach/v2/CoachBriefHero";
import AskCoachPill from "@/components/coach/v2/AskCoachPill";
import CoachFooterLinks from "@/components/coach/v2/CoachFooterLinks";
import HealthKitConnectCard from "@/components/health/HealthKitConnectCard";

type Msg = { role: "user" | "assistant"; content: string };
const STORAGE_KEY = "w_coach_messages_v1";

const Coach = () => {
  // FIX (migration 20260511 commit): the page previously read `isPremium`
  // and `subscriptionLoading` from useAuth(), but AuthContext exports
  // `isElite` and `loading`. Reading missing fields meant `!isPremium` was
  // always truthy and EVERY user saw the upsell — including paying Elite
  // users. The correct names are used now.
  const { session, loading } = useAuth();
  const navigate = useNavigate();
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
    return (
      <div className="flex flex-col h-full">
        <CoachHeader onBack={() => navigate(-1)} navigate={navigate} />
        <div className="flex-1 flex items-center justify-center px-6 text-center">
          <div className="max-w-sm space-y-4">
            <div className="text-3xl" aria-hidden>⚠️</div>
            <h2 className="text-lg font-display font-bold">W Coach failed to load</h2>
            <p className="text-sm text-muted-foreground leading-relaxed break-words">
              {err.message || "Unknown error"}
            </p>
            <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
              If this mentions "relation does not exist", the Coach database
              tables haven't been deployed yet. Apply the migrations under
              <code className="px-1 mx-1 rounded bg-card/60 border border-border/40">
                supabase/migrations/
              </code>
              and try again.
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
  if (!athlete?.onboarded && !onboardSkipped) {
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
      <h1 className="font-display text-base font-black tracking-tight">W Coach</h1>
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
          <div className="absolute right-3 top-12 z-40 w-48 rounded-2xl border border-border/60 bg-card shadow-[0_18px_56px_-12px_hsl(var(--background)/0.8)] overflow-hidden">
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
  const [chatOpen, setChatOpen] = useState(false);
  const [chatPrompt, setChatPrompt] = useState<string | null>(null);

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
        <AskCoachPill onOpenChat={() => openChat()} onBrowseFaq={() => openChat()} />
        <StateCard />
        <MoveCard />
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
            onClose={() => { setChatOpen(false); setChatPrompt(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Free Coach upsell (playbook FAQ + live-chat upsell) ────────────────────────
// Free users tap "Ask Coach" → land here. They browse the curated playbook for
// instant answers (real value, no network call), and each answer ends with a
// soft upsell to unlock live, data-aware coaching. Value first, then the ask.
const FreeCoachUpsell = ({ navigate, onClose }: { navigate: any; onClose: () => void }) => {
  const [selected, setSelected] = useState<FaqEntry | null>(null);

  if (selected) {
    return (
      <div className="absolute inset-0 z-50 bg-background flex flex-col">
        <div className="shrink-0 px-3 pt-3 pb-2 flex items-center gap-2 border-b border-border/30">
          <button
            onClick={() => { hapticImpact("light"); setSelected(null); }}
            className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-card/60"
            aria-label="Back to playbook"
          >
            <ArrowLeft size={18} />
          </button>
          <p className="font-display text-sm font-black tracking-tight truncate">{selected.question}</p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="prose prose-invert prose-sm max-w-none text-sm leading-relaxed">
            <ReactMarkdown>{selected.answer_md}</ReactMarkdown>
          </div>

          <div className="mt-6 rounded-2xl border border-gold/30 bg-gradient-to-b from-gold/[0.08] to-card p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gold/85 mb-1">
              Want this tailored to you?
            </p>
            <p className="text-[13px] font-medium text-foreground/90 leading-snug mb-3">
              Live W Coach reads your check-ins, sleep and training to answer in your context — not generic tips.
            </p>
            <Button variant="gold" size="lg" className="w-full font-black" onClick={() => navigate("/paywall")}>
              <Sparkles size={16} strokeWidth={2.6} /> Unlock live coaching
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <FaqBrowser onClose={onClose} onSelect={setSelected} />;
};

// ── Chat sheet (slide-up over content) ────────────────────────────────────────
// (PersistentComposer removed — it was a fixed input bar pinned above
// BottomNav that gave /coach a sub-app feel no other W page has. Chat is
// now reached via the inline "Ask your coach" card at the bottom of the
// scroll, matching every other W destination's CTA pattern.)
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
          go_deep: !!opts?.goDeep,
          faq_context: lastFaqRef.current
            ? { question: lastFaqRef.current.question, answer: lastFaqRef.current.answer_md }
            : null,
          // Forward pre-chat mood snapshot (if captured this session).
          // Edge function falls back to the latest coach_reflection row otherwise.
          mood_today: moodSnapshot,
          // Local tz offset so the coach can judge timing (streak at risk tonight, etc).
          tz_offset: new Date().getTimezoneOffset(),
        }),
      });
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

        if (resp.status === 429) toast.error("Coach is busy. Try again in a moment.");
        else if (resp.status === 402) toast.error("OpenRouter credits exhausted. Top up at openrouter.ai/credits.");
        else if (resp.status === 401) toast.error("OpenRouter API key invalid.");
        else toast.error(`Coach failed to respond — ${summary}`);

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: detail
              ? `**Coach failed to respond.**\n\n\`\`\`\n${detail}\n\`\`\`\n\nTap to retry.`
              : "Coach lost connection. Tap to retry.",
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

  const quickAnswers = COACH_FAQ.slice(0, 6);

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

      <div className="shrink-0 px-3 pt-1 pb-2 flex items-center justify-between border-b border-border/30 bg-background/85 backdrop-blur-xl">
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
              {m.role === "assistant" && !m.failed && !m.isFaq && !streaming && i === messages.length - 1 && m.content.length > 60 && (
                <button
                  type="button"
                  onClick={goDeeper}
                  className="mt-1.5 ml-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-gold/85 hover:text-gold transition"
                >
                  <Sparkles size={10} /> Go deeper
                </button>
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
    </>
  );
};

export default Coach;
