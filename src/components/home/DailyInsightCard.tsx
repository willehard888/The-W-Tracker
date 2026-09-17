import { lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTrialAccess } from "@/hooks/use-trial-access";
import TodayPractice from "@/components/vault/TodayPractice";

// Lazy: the quote pool is for non-members only (see InsightQuote).
const InsightQuote = lazy(() => import("@/components/home/InsightQuote"));

/**
 * The Vault's voice on Home. For a member it is today's practice: one
 * thinker's lens, one piece, one question, one door (TodayPractice). For
 * everyone else it stays the editorial pull-quote, deep-linked into the
 * matching lesson, so a non-member tap lands on the paywall and the quote
 * doubles as a teaser.
 *
 * Type-only (no surface, no gold tile) is deliberate: it breaks the stacked-
 * card silhouette and gives the "vault" its own voice above the shelf.
 */
const DailyInsightCard = () => {
  const navigate = useNavigate();
  const { isPremium } = useAuth();
  const { isInTrial } = useTrialAccess();

  if (isPremium || isInTrial) {
    return <TodayPractice onOpen={(slug) => navigate(`/vault?lesson=${slug}`)} />;
  }
  // The fallback holds the quote's height so Home does not jump when it lands.
  return (
    <Suspense fallback={<div aria-hidden className="min-h-[7.5rem]" />}>
      <InsightQuote />
    </Suspense>
  );
};

export default DailyInsightCard;
