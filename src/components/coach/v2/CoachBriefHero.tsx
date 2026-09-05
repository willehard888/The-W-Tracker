import ReactMarkdown from "react-markdown";
import { Sparkles, Send, MessageCircle } from "lucide-react";
import { useCoachBrief } from "@/hooks/use-coach-brief";
import { stripCoachSignoff } from "@/lib/coach-signoff";

/**
 * CoachBriefHero — the proactive AI voice at the very top of the Coach page.
 * AI Coach speaks first: greets, references the user's real data, gives today's
 * direction, then offers tailored questions that open the live chat. This is
 * what makes the app feel like an AI coach instead of a set of static cards.
 */
const CoachBriefHero = ({
  onOpenChat,
  onAsk,
}: {
  onOpenChat: () => void;
  onAsk: (question: string) => void;
}) => {
  const { brief, isLoading } = useCoachBrief();

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-gold/30 bg-gradient-to-b from-gold/[0.08] via-card/95 to-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-5 w-5 rounded-full bg-gold/30 animate-pulse" />
          <div className="h-3 w-24 rounded bg-gold/20 animate-pulse" />
        </div>
        <div className="space-y-2">
          <div className="h-3.5 w-full rounded bg-card/80 animate-pulse" />
          <div className="h-3.5 w-[85%] rounded bg-card/80 animate-pulse" />
          <div className="h-3.5 w-[60%] rounded bg-card/80 animate-pulse" />
        </div>
        <p className="text-[12px] text-gold/50 mt-3 italic">AI Coach is reading your week…</p>
      </div>
    );
  }

  // Graceful fallback — still lead with the AI, just invite a conversation.
  if (!brief) {
    return (
      <button
        onClick={onOpenChat}
        className="press w-full text-left rounded-3xl border border-gold/35 bg-gradient-to-b from-gold/[0.08] via-card/95 to-card p-5 transition-transform shadow-[0_18px_56px_-30px_hsl(var(--gold)/0.45)]"
      >
        <div className="flex items-center gap-2 mb-1.5">
          <Sparkles size={14} className="text-gold" />
          <p className="eyebrow">AI Coach</p>
        </div>
        <p className="text-[14px] font-bold text-foreground leading-snug">
          I'm your coach. Tell me how today's going and I'll build the next move around your data.
        </p>
        <span className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-black text-gold">
          <Send size={13} /> Talk to your coach
        </span>
      </button>
    );
  }

  return (
    <div className="rounded-3xl border border-gold/35 bg-gradient-to-b from-gold/[0.10] via-card/95 to-card p-5 shadow-[0_18px_56px_-30px_hsl(var(--gold)/0.45)]">
      {/* Header — live AI signal + ribbon */}
      <div className="flex items-center gap-2 mb-3">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-gold opacity-60 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
        </span>
        <p className="eyebrow">AI Coach</p>
        {brief.ribbon && (
          <span className="eyebrow-sm ml-auto text-gold/70 bg-gold/10 border border-gold/25 rounded-full px-2 py-0.5 truncate max-w-[55%]">
            {brief.ribbon}
          </span>
        )}
      </div>

      {/* The AI's words — the centrepiece. Sign-off stripped: briefs written
          before the prompt change end with "— W Coach", and there's no
          backfill, so old rows would still show the retired name right under
          an "AI Coach" eyebrow. */}
      <div className="text-[14px] leading-relaxed text-foreground/90 [&_p]:mb-2 [&_strong]:text-gold [&_strong]:font-black">
        <ReactMarkdown>{stripCoachSignoff(brief.brief_md)}</ReactMarkdown>
      </div>

      {/* Prescriptions — today's targets, fitted to the user */}
      {brief.prescriptions?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {brief.prescriptions.map((p, i) => (
            <span key={i} className="inline-flex items-baseline gap-1 rounded-lg bg-card/70 border border-border/50 px-2.5 py-1">
              <span className="eyebrow-sm text-muted-foreground/70">{p.label}</span>
              <span className="text-[12px] font-black text-gold tabular-nums">{p.value}</span>
            </span>
          ))}
        </div>
      )}

      {/* Suggested questions — tap to open chat pre-loaded */}
      {brief.suggested_questions?.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {brief.suggested_questions.slice(0, 3).map((q, i) => (
            <button
              key={i}
              onClick={() => onAsk(q)}
              className="press w-full flex items-center gap-2 rounded-xl border border-gold/20 bg-gold/[0.04] px-3 py-2.5 text-left transition-transform"
            >
              <MessageCircle size={13} className="text-gold/70 shrink-0" />
              <span className="text-[12px] font-semibold text-foreground/85 leading-snug">{q}</span>
            </button>
          ))}
        </div>
      )}

      {/* Primary CTA — open the live coach */}
      <button
        onClick={onOpenChat}
        className="press mt-4 w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gold py-3 text-[13px] font-black text-primary-foreground shadow-[0_3px_14px_-2px_hsl(42_78%_50%/0.45)] transition-transform"
      >
        <Send size={15} /> Ask your coach anything
      </button>
    </div>
  );
};

export default CoachBriefHero;
