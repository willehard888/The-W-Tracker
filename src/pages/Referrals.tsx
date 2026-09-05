import { useState } from "react";
import { Copy, Check, Share2, Image as ImageIcon } from "lucide-react";
import PageBar from "@/components/ui/page-bar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import TopInvitersWidget from "@/components/TopInvitersWidget";
import StoryShareModal from "@/components/StoryShareModal";
import { useReferralStats } from "@/hooks/use-referral-stats";
import { useMyReferrals } from "@/hooks/use-my-referrals";
import { useCommitPop } from "@/hooks/use-commit-pop";
import { track, FUNNEL } from "@/lib/analytics";
import { fmtDate, fmtInt } from "@/lib/format";
import { freeMonthsEarned, paidToNextMonth, BADGE_MILESTONES, CREDIT_EVERY } from "@/lib/referral-rewards";
import { cn } from "@/lib/utils";
import { shareText } from "@/lib/share-image";

/**
 * Three paid friends, one free month. The opening line is the deal in the
 * user's own numbers; the hero is the code and its Share pair; everything
 * else is type and hairlines.
 */
const Referrals = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const copiedPop = useCommitPop(copied);
  const [shareCardOpen, setShareCardOpen] = useState(false);
  const { data: stats } = useReferralStats(profile?.user_id);

  // MUST run before the early return — a hook after `return null` crashes with
  // "Rendered more hooks than during the previous render" the moment profile
  // resolves (same class of bug already fixed in Paywall.tsx).
  const { data: recruits } = useMyReferrals();

  if (!profile) return null;

  // Hardcoded canonical origin — window.location.origin is capacitor://localhost
  // inside the native shell, which made every shared link dead on arrival.
  const referralLink = `https://whealthfactory.com/auth?ref=${profile.referral_code || profile.username}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success("Link copied!");
      void track(FUNNEL.inviteShared, { method: "copy" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleNativeShare = async () => {
    const ok = await shareText({
      title: "Join Whealth Factory",
      text: `Train with me on Whealth Factory — daily check-ins, AI coach, the full system. Join here: ${referralLink}`,
      url: referralLink,
    });
    if (ok) void track(FUNNEL.inviteShared, { method: "native" });
    else handleCopy();
  };

  const referralCode = profile.referral_code || profile.username;

  // The deal: every 3 paid friends = 1 free month, no cap.
  const paidCount = stats?.convertedCount ?? profile.referral_count ?? 0;
  const monthsEarned = freeMonthsEarned(paidCount);
  const toNextMonth = paidToNextMonth(paidCount);
  const creditsUntil = profile.membership_credits_until
    ? new Date(profile.membership_credits_until)
    : null;
  const creditsActive = !!creditsUntil && creditsUntil.getTime() > Date.now();

  const standing: [number, string][] = [
    [stats?.signupCount ?? 0, "joined"],
    [paidCount, "paid"],
    [monthsEarned, monthsEarned === 1 ? "free month" : "free months"],
  ];

  return (
    <div className="min-h-full">
      <PageBar title="Referrals" onBack={() => navigate(-1)} />

      <div className="px-4 pt-4 pb-6">
        {/* Opening beat — the deal, in the user's own numbers. */}
        <h2 className="home-rise font-display font-black text-[27px] leading-[1.04] tracking-tight">
          {paidCount > 0
            ? `${paidCount % CREDIT_EVERY} of ${CREDIT_EVERY}. ${toNextMonth} ${toNextMonth === 1 ? "friend" : "friends"} to a free month.`
            : "Three paid friends. One month free."}
        </h2>

        {/* Hero — the code and its Share pair. The code is the screen's gold. */}
        <div className="home-rise home-rise-1 surface-card p-5 mt-5">
          <p className="text-[12px] text-muted-foreground">Your invite code</p>
          <p className="font-display text-[30px] font-black text-gold glow-gold-text tracking-wide truncate leading-none mt-1.5">
            {referralCode}
          </p>
          <p className="text-[11px] text-muted-foreground/60 truncate mt-2">{referralLink}</p>
          <div className="grid grid-cols-2 gap-2 mt-4">
            <Button variant="gold-soft" size="lg" onClick={handleCopy}>
              <span className={cn("inline-flex items-center gap-2", copiedPop && "commit-pop")}>
                {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
                {copied ? "Copied" : "Copy"}
              </span>
            </Button>
            <Button variant="ember" size="lg" onClick={handleNativeShare}>
              <Share2 size={16} aria-hidden /> Share
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-2 min-h-11 text-muted-foreground"
            onClick={() => setShareCardOpen(true)}
          >
            <ImageIcon aria-hidden /> Share a story card
          </Button>
        </div>

        {/* Standing — one quiet line, values inline. */}
        <div className="home-rise home-rise-2 surface-card surface-card-quiet mt-4 px-4 py-3 flex items-baseline gap-x-4 gap-y-1 flex-wrap">
          {standing.map(([n, label]) => (
            <span key={label} className="inline-flex items-baseline gap-1">
              <span className="font-display font-black text-[17px] tabular-nums leading-none">{fmtInt(n)}</span>
              <span className="text-[11px] text-muted-foreground">{label}</span>
            </span>
          ))}
          {creditsActive && creditsUntil && (
            <span className="ml-auto text-[11px] text-muted-foreground">Free until {fmtDate(creditsUntil)}</span>
          )}
        </div>

        {/* Recruits — who came, and how far they got. */}
        {(recruits?.length ?? 0) > 0 && (
          <section className="home-rise home-rise-3 mt-7">
            <h3 className="font-display font-bold text-sm tracking-tight">Your recruits</h3>
            <div className="divide-y divide-border/35 mt-1">
              {recruits!.map((r, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5">
                  <div className="h-9 w-9 rounded-full overflow-hidden bg-secondary flex items-center justify-center font-black text-xs text-muted-foreground shrink-0">
                    {r.avatar_url ? (
                      <img src={r.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      (r.referred_username?.charAt(0) || "?").toUpperCase()
                    )}
                  </div>
                  <p className="flex-1 min-w-0 text-[13px] font-bold truncate">@{r.referred_username}</p>
                  <p
                    className={cn(
                      "text-[11px] font-bold shrink-0",
                      r.converted ? "text-xp-green" : r.activated_at ? "text-ember" : "text-muted-foreground",
                    )}
                  >
                    {r.converted ? "Premium" : r.activated_at ? "Active" : "Joined"}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Active = 3 check-ins (+250 XP to you). Free months land when they go Premium.
            </p>
          </section>
        )}

        {/* How it works — three lines of type. */}
        <section className="home-rise home-rise-4 mt-7">
          <h3 className="font-display font-bold text-sm tracking-tight">How it works</h3>
          <ul className="mt-2 space-y-1.5 text-[13px] text-muted-foreground leading-snug">
            <li>Share your code. Friends get a 14-day free trial.</li>
            <li>They show up. 50 XP to you when they join, 250 XP at their third check-in.</li>
            <li>Every three who go paid give you a month free. No cap.</li>
          </ul>
        </section>

        {/* Badge milestones — bragging rights, never credits or status. */}
        <section className="home-rise home-rise-4 mt-7">
          <div className="flex items-baseline justify-between">
            <h3 className="font-display font-bold text-sm tracking-tight">Badge milestones</h3>
            <p className="text-[11px] text-muted-foreground">paid friends</p>
          </div>
          <div className="divide-y divide-border/35 mt-1">
            {BADGE_MILESTONES.map((m) => {
              const unlocked = paidCount >= m.count;
              return (
                <div key={m.count} className={cn("flex items-center gap-3 py-2.5", !unlocked && "text-muted-foreground")}>
                  <span className="w-7 shrink-0 font-display font-black text-sm tabular-nums">{m.count}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold tracking-tight">{m.title}</p>
                    <p className="text-[12px] text-muted-foreground leading-snug">{m.detail}</p>
                  </div>
                  {unlocked && <Check size={14} className="shrink-0" aria-hidden />}
                </div>
              );
            })}
          </div>
        </section>

        {/* Top Inviters — social proof & competition */}
        <div className="home-rise home-rise-5 mt-7">
          <TopInvitersWidget hideEmptyCta />
        </div>

        <StoryShareModal
          open={shareCardOpen}
          onClose={() => setShareCardOpen(false)}
          variant="referral"
          referralCode={referralCode}
          referralLink={referralLink}
        />
      </div>
    </div>
  );
};

export default Referrals;
