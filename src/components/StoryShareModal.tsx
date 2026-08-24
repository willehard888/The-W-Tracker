import { useRef, useState } from "react";
import { Portal } from "@/components/ui/Portal";
import { Download, Share2, X, Flame, Zap, Trophy, Crown, Sparkles, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import BrandLogo, { LOGO_DATA_URI } from "@/components/BrandLogo";
import { shareImage, saveImage, shareText } from "@/lib/share-image";
import { isNativePlatform } from "@/lib/platform";
import { getTierConfig } from "@/lib/status-tiers";
import { track, FUNNEL } from "@/lib/analytics";

interface StoryShareModalProps {
  open: boolean;
  onClose: () => void;
  variant?: "stats" | "badge" | "streak" | "referral" | "whealth";
  /** Whealth variant: the live index values to render. */
  whealthData?: { overall: number; pillars: Record<string, number | null> };
  badgeData?: { name: string; icon: string; rarity: string };
  /** Referral variant: the inviter's code + full link. */
  referralCode?: string;
  referralLink?: string;
}

const StoryShareModal = ({ open, onClose, variant = "stats", badgeData, referralCode, referralLink, whealthData }: StoryShareModalProps) => {
  const { profile } = useAuth();
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);

  if (!open || !profile) return null;

  const tier = profile.status_tier || 'recruit';
  const tierConfig = getTierConfig(tier);

  // Renders the story card to a PNG blob — shared by Save Image and Share.
  const generateBlob = async (): Promise<Blob | null> => {
    if (!cardRef.current) return null;
    {
      const card = cardRef.current;
      const canvas = document.createElement("canvas");
      const scale = 3;
      const w = 1080;
      const h = 1440; // 3:4 aspect
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      const s = w / card.offsetWidth;
      ctx.scale(s, s);
      const cardH = h / s;

      // The brand mark is an inline data URI — decodes instantly, no CORS.
      const logo = new Image();
      logo.src = LOGO_DATA_URI;
      try { await logo.decode(); } catch { /* text fallback below */ }

      // Background gradient based on tier
      const gradient = ctx.createLinearGradient(0, 0, card.offsetWidth, cardH);
      if (tier === 'legend') {
        gradient.addColorStop(0, "#1a0a2e");
        gradient.addColorStop(0.5, "#0d1117");
        gradient.addColorStop(1, "#1a0515");
      } else if (tier === 'apex') {
        gradient.addColorStop(0, "#1a0f08");
        gradient.addColorStop(1, "#0d1117");
      } else if (tier === 'elite') {
        gradient.addColorStop(0, "#1a1508");
        gradient.addColorStop(1, "#0a0c12");
      } else {
        gradient.addColorStop(0, "#0a0c12");
        gradient.addColorStop(1, "#060810");
      }
      ctx.fillStyle = gradient;
      ctx.roundRect(0, 0, card.offsetWidth, cardH, 24);
      ctx.fill();

      // Top accent line
      const goldGrad = ctx.createLinearGradient(0, 0, card.offsetWidth, 0);
      if (tier === 'legend') {
        goldGrad.addColorStop(0, "rgba(138, 79, 255, 0)");
        goldGrad.addColorStop(0.3, "rgba(138, 79, 255, 0.8)");
        goldGrad.addColorStop(0.5, "rgba(202, 158, 62, 0.9)");
        goldGrad.addColorStop(0.7, "rgba(220, 80, 100, 0.8)");
        goldGrad.addColorStop(1, "rgba(220, 80, 100, 0)");
      } else if (tier === 'apex') {
        goldGrad.addColorStop(0, "rgba(235, 87, 27, 0)");
        goldGrad.addColorStop(0.5, "rgba(235, 87, 27, 0.9)");
        goldGrad.addColorStop(1, "rgba(202, 158, 62, 0)");
      } else {
        goldGrad.addColorStop(0, "rgba(202, 158, 62, 0)");
        goldGrad.addColorStop(0.5, "rgba(202, 158, 62, 0.8)");
        goldGrad.addColorStop(1, "rgba(202, 158, 62, 0)");
      }
      ctx.fillStyle = goldGrad;
      ctx.fillRect(30, 14, card.offsetWidth - 60, 3);

      // Bottom accent
      ctx.fillRect(30, cardH - 17, card.offsetWidth - 60, 1);

      // Title
      ctx.fillStyle = "rgba(202, 158, 62, 0.9)";
      ctx.font = "bold 11px 'Inter', system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("WHEALTH FACTORY", card.offsetWidth / 2, 44);

      // Tier badge
      ctx.fillStyle = tier === 'legend' ? "rgba(138, 79, 255, 0.9)" :
                      tier === 'apex' ? "rgba(235, 87, 27, 0.9)" :
                      tier === 'elite' ? "rgba(202, 158, 62, 0.9)" :
                      "rgba(255,255,255,0.4)";
      ctx.font = "900 9px 'Inter', system-ui, sans-serif";
      ctx.fillText(`${tierConfig.emoji} ${tierConfig.label.toUpperCase()}`, card.offsetWidth / 2, 60);

      if (variant === "stats") {
        const centerY = cardH / 2;
        
        ctx.fillStyle = "#f0ece4";
        ctx.font = "800 26px 'Space Grotesk', system-ui, sans-serif";
        ctx.fillText(`@${profile.username}`, card.offsetWidth / 2, centerY - 80);

        // XP with glow effect
        ctx.shadowColor = "rgba(202, 158, 62, 0.5)";
        ctx.shadowBlur = 20;
        ctx.fillStyle = "rgba(202, 158, 62, 1)";
        ctx.font = "900 56px 'Space Grotesk', system-ui, sans-serif";
        ctx.fillText(`${profile.xp.toLocaleString()}`, card.offsetWidth / 2, centerY - 5);
        ctx.shadowBlur = 0;

        ctx.fillStyle = "rgba(202, 158, 62, 0.5)";
        ctx.font = "bold 13px 'Inter', system-ui, sans-serif";
        ctx.fillText("TOTAL XP", card.offsetWidth / 2, centerY + 18);

        // Stats row with separators
        const statsY = centerY + 66;
        const stats = [
          { label: "STREAK", value: `${profile.streak}d`, emoji: "🔥" },
          { label: "LEVEL", value: `${profile.level}`, emoji: "⚡" },
          { label: "BEST", value: `${profile.longest_streak}d`, emoji: "🏆" },
        ];
        const colW = card.offsetWidth / 3;
        stats.forEach((s, i) => {
          const x = colW * i + colW / 2;
          ctx.fillStyle = "#f0ece4";
          ctx.font = "900 22px 'Space Grotesk', system-ui, sans-serif";
          ctx.fillText(`${s.emoji} ${s.value}`, x, statsY);
          ctx.fillStyle = "rgba(255,255,255,0.3)";
          ctx.font = "bold 8px 'Inter', system-ui, sans-serif";
          ctx.fillText(s.label, x, statsY + 16);
        });

        // Dividers
        ctx.strokeStyle = "rgba(202, 158, 62, 0.15)";
        ctx.lineWidth = 1;
        [1, 2].forEach((i) => {
          ctx.beginPath();
          ctx.moveTo(colW * i, statsY - 20);
          ctx.lineTo(colW * i, statsY + 22);
          ctx.stroke();
        });

        ctx.fillStyle = "rgba(255,255,255,0.2)";
        ctx.font = "700 9px 'Inter', system-ui, sans-serif";
        ctx.fillText("DISCIPLINE IS THE NEW FLEX", card.offsetWidth / 2, cardH - 30);

      } else if (variant === "streak") {
        const centerY = cardH / 2;
        
        ctx.fillStyle = "#f0ece4";
        ctx.font = "800 22px 'Space Grotesk', system-ui, sans-serif";
        ctx.fillText(`@${profile.username}`, card.offsetWidth / 2, centerY - 80);

        // Large fire with glow
        ctx.font = "72px serif";
        ctx.shadowColor = "rgba(235, 87, 27, 0.5)";
        ctx.shadowBlur = 30;
        ctx.fillText("🔥", card.offsetWidth / 2, centerY - 5);
        ctx.shadowBlur = 0;

        ctx.shadowColor = "rgba(202, 158, 62, 0.4)";
        ctx.shadowBlur = 15;
        ctx.fillStyle = "rgba(202, 158, 62, 1)";
        ctx.font = "900 52px 'Space Grotesk', system-ui, sans-serif";
        ctx.fillText(`${profile.streak}`, card.offsetWidth / 2, centerY + 52);
        ctx.shadowBlur = 0;

        ctx.fillStyle = "rgba(202, 158, 62, 0.7)";
        ctx.font = "900 18px 'Space Grotesk', system-ui, sans-serif";
        ctx.fillText("DAY STREAK", card.offsetWidth / 2, centerY + 76);

        // Pressure text
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.font = "bold 10px 'Inter', system-ui, sans-serif";
        ctx.fillText(
          profile.streak >= 30 ? "MOST FAIL BEFORE THIS →" :
          profile.streak >= 7 ? "DON'T BREAK NOW →" :
          "BEAT MY STREAK →",
          card.offsetWidth / 2, centerY + 110
        );

        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.font = "600 8px 'Inter', system-ui, sans-serif";
        ctx.fillText(`Best: ${profile.longest_streak} days`, card.offsetWidth / 2, cardH - 30);

      } else if (variant === "badge" && badgeData) {
        const centerY = cardH / 2;
        
        ctx.fillStyle = "#f0ece4";
        ctx.font = "800 22px 'Space Grotesk', system-ui, sans-serif";
        ctx.fillText(`@${profile.username}`, card.offsetWidth / 2, centerY - 65);

        ctx.font = "64px serif";
        ctx.shadowColor = badgeData.rarity === 'legendary' ? "rgba(202, 158, 62, 0.6)" :
                          badgeData.rarity === 'epic' ? "rgba(138, 79, 255, 0.5)" : "rgba(0,0,0,0)";
        ctx.shadowBlur = badgeData.rarity === 'legendary' || badgeData.rarity === 'epic' ? 25 : 0;
        ctx.fillText(badgeData.icon, card.offsetWidth / 2, centerY + 15);
        ctx.shadowBlur = 0;

        ctx.fillStyle = "#f0ece4";
        ctx.font = "800 20px 'Space Grotesk', system-ui, sans-serif";
        ctx.fillText(badgeData.name, card.offsetWidth / 2, centerY + 60);

        const rarityColor = badgeData.rarity === 'legendary' ? "rgba(202, 158, 62, 0.9)" :
                           badgeData.rarity === 'epic' ? "rgba(138, 79, 255, 0.9)" :
                           badgeData.rarity === 'rare' ? "rgba(59, 130, 246, 0.9)" :
                           "rgba(255,255,255,0.4)";
        ctx.fillStyle = rarityColor;
        ctx.font = "bold 10px 'Inter', system-ui, sans-serif";
        ctx.fillText(badgeData.rarity.toUpperCase(), card.offsetWidth / 2, centerY + 82);

        if (badgeData.rarity === 'legendary') {
          ctx.fillStyle = "rgba(202, 158, 62, 0.3)";
          ctx.font = "600 9px 'Inter', system-ui, sans-serif";
          ctx.fillText("ONLY TOP 1% EARN THIS", card.offsetWidth / 2, centerY + 102);
        }

        ctx.fillStyle = "rgba(255,255,255,0.2)";
        ctx.font = "600 9px 'Inter', system-ui, sans-serif";
        ctx.fillText("BADGE UNLOCKED", card.offsetWidth / 2, cardH - 30);

      } else if (variant === "whealth" && whealthData) {
        const cx = card.offsetWidth / 2;
        const centerY = cardH / 2 - 30;

        ctx.fillStyle = "#f0ece4";
        ctx.font = "800 20px 'Space Grotesk', system-ui, sans-serif";
        ctx.fillText(`@${profile.username}`, cx, centerY - 92);

        // 270° gauge arc
        const R = 62;
        ctx.lineWidth = 9;
        ctx.lineCap = "round";
        const a0 = 0.75 * Math.PI;
        const aFull = a0 + 1.5 * Math.PI;
        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        ctx.beginPath();
        ctx.arc(cx, centerY + 10, R, a0, aFull);
        ctx.stroke();
        const aVal = a0 + 1.5 * Math.PI * (whealthData.overall / 100);
        const arcGrad = ctx.createLinearGradient(cx - R, centerY - R, cx + R, centerY + R);
        arcGrad.addColorStop(0, "rgba(240, 205, 120, 1)");
        arcGrad.addColorStop(1, "rgba(202, 158, 62, 1)");
        ctx.strokeStyle = arcGrad;
        ctx.shadowColor = "rgba(202, 158, 62, 0.5)";
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(cx, centerY + 10, R, a0, aVal);
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.fillStyle = "rgba(202, 158, 62, 1)";
        ctx.font = "900 44px 'Space Grotesk', system-ui, sans-serif";
        ctx.fillText(`${whealthData.overall}`, cx, centerY + 24);
        ctx.fillStyle = "rgba(202, 158, 62, 0.7)";
        ctx.font = "900 11px 'Space Grotesk', system-ui, sans-serif";
        ctx.fillText("WHEALTH INDEX", cx, centerY + 44);

        // Six mini pillar bars
        const pillars: Array<[string, number | null]> = [
          ["SLP", whealthData.pillars.sleep], ["RCV", whealthData.pillars.recovery],
          ["MOV", whealthData.pillars.movement], ["NUT", whealthData.pillars.nutrition],
          ["MND", whealthData.pillars.mind], ["INR", whealthData.pillars.inner],
        ];
        const barW = 28, gap = 10;
        const totalW = pillars.length * barW + (pillars.length - 1) * gap;
        let bx = cx - totalW / 2;
        const barBase = centerY + 122;
        for (const [label, v] of pillars) {
          ctx.fillStyle = "rgba(255,255,255,0.08)";
          ctx.fillRect(bx, barBase - 44, barW, 44);
          if (v != null) {
            ctx.fillStyle = v >= 75 ? "rgba(202,158,62,1)" : v >= 50 ? "rgba(202,158,62,0.7)" : "rgba(235,87,27,0.85)";
            const hh = Math.max(3, (v / 100) * 44);
            ctx.fillRect(bx, barBase - hh, barW, hh);
          }
          ctx.fillStyle = "rgba(255,255,255,0.35)";
          ctx.font = "800 7px 'Inter', system-ui, sans-serif";
          ctx.fillText(label, bx + barW / 2, barBase + 12);
          bx += barW + gap;
        }

        ctx.fillStyle = "rgba(255,255,255,0.2)";
        ctx.font = "600 9px 'Inter', system-ui, sans-serif";
        ctx.fillText("COMPUTED FROM ALL MY DATA", cx, cardH - 30);

      } else if (variant === "referral") {
        const cx = card.offsetWidth / 2;
        const centerY = cardH / 2;
        const code = (referralCode || profile.username).toUpperCase();

        // Depth: a warm radial glow behind the center + drifting ember dots —
        // the flat gradient alone read cheap on a bright phone screen.
        const glow = ctx.createRadialGradient(cx, centerY - 40, 10, cx, centerY - 40, card.offsetWidth * 0.75);
        const glowTint = tier === "legend" ? "160, 90, 255" : tier === "apex" ? "235, 110, 40" : "202, 158, 62";
        glow.addColorStop(0, `rgba(${glowTint}, 0.16)`);
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, card.offsetWidth, cardH);
        const embers: Array<[number, number, number, number]> = [
          [0.12, 0.16, 1.6, 0.5], [0.85, 0.12, 1.2, 0.35], [0.2, 0.82, 1.4, 0.4],
          [0.9, 0.72, 1.8, 0.5], [0.08, 0.55, 1.1, 0.3], [0.78, 0.4, 1.3, 0.35],
          [0.3, 0.06, 1.0, 0.3], [0.62, 0.9, 1.5, 0.45], [0.45, 0.24, 0.9, 0.25],
        ];
        for (const [px, py, r, a] of embers) {
          ctx.fillStyle = `rgba(${glowTint}, ${a})`;
          ctx.beginPath();
          ctx.arc(px * card.offsetWidth, py * cardH, r, 0, Math.PI * 2);
          ctx.fill();
        }

        // Brand mark — the real logo, centered above the headline.
        if (logo.complete && logo.naturalWidth > 0) {
          const ls = 52;
          ctx.save();
          ctx.shadowColor = "rgba(202,158,62,0.55)";
          ctx.shadowBlur = 22;
          ctx.drawImage(logo, cx - ls / 2, centerY - 158, ls, ls);
          ctx.restore();
        }

        ctx.fillStyle = "#f0ece4";
        ctx.font = "800 34px 'Space Grotesk', system-ui, sans-serif";
        ctx.fillText("Train with me.", cx, centerY - 62);

        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.font = "600 13px 'Inter', system-ui, sans-serif";
        ctx.fillText(`@${profile.username} on Whealth Factory`, cx, centerY - 38);

        // Invite-code chip — the font AUTOFITS so long codes never wrap or clip.
        const boxW = card.offsetWidth - 72, boxH = 66, boxX = 36, boxY = centerY - 12;
        const chipGrad = ctx.createLinearGradient(boxX, boxY, boxX + boxW, boxY + boxH);
        chipGrad.addColorStop(0, "rgba(202, 158, 62, 0.16)");
        chipGrad.addColorStop(1, "rgba(202, 158, 62, 0.06)");
        ctx.fillStyle = chipGrad;
        ctx.beginPath(); ctx.roundRect(boxX, boxY, boxW, boxH, 14); ctx.fill();
        ctx.strokeStyle = "rgba(202, 158, 62, 0.6)"; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = "rgba(202,158,62,0.7)";
        ctx.font = "700 9px 'Inter', system-ui, sans-serif";
        ctx.fillText("YOUR INVITE CODE", cx, boxY + 21);
        let codeSize = 26;
        ctx.fillStyle = "rgba(212, 172, 80, 1)";
        do {
          ctx.font = `900 ${codeSize}px 'Space Grotesk', system-ui, sans-serif`;
          if (ctx.measureText(code).width <= boxW - 28) break;
          codeSize -= 1;
        } while (codeSize > 10);
        ctx.save();
        ctx.shadowColor = "rgba(202,158,62,0.45)";
        ctx.shadowBlur = 14;
        ctx.fillText(code, cx, boxY + 50);
        ctx.restore();

        // Value line — the trial pitch is gone (every new user gets the trial
        // anyway); sell what the app IS.
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = "600 11.5px 'Inter', system-ui, sans-serif";
        ctx.fillText("AI coach · daily check-ins · the full system", cx, centerY + 82);

        ctx.fillStyle = "rgba(202,158,62,0.55)";
        ctx.font = "700 10px 'Inter', system-ui, sans-serif";
        ctx.fillText("USE MY CODE AT SIGN-UP", cx, cardH - 30);
      }
      return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    }
  };

  const shareCaption =
    variant === "referral"
      ? `Train with me on Whealth Factory — daily check-ins, AI coach, the full system. Use my invite code ${(referralCode || profile.username).toUpperCase()}: ${referralLink || "https://whealthfactory.com"}`
      : variant === "streak"
      ? `🔥 ${profile.streak}-day streak on Whealth Factory. ${profile.streak >= 30 ? "30 days strong." : "Beat my streak!"} https://whealthfactory.com/u/${profile.username}`
      : variant === "badge" && badgeData
      ? `Just unlocked ${badgeData.name} ${badgeData.icon} (${badgeData.rarity.toUpperCase()}) on Whealth Factory! https://whealthfactory.com/u/${profile.username}`
      : variant === "whealth" && whealthData
      ? `Whealth Index ${whealthData.overall}/100 on Whealth Factory — one number for sleep, recovery, movement, nutrition, mind & inner work. https://whealthfactory.com/u/${profile.username}`
      : `${profile.xp.toLocaleString()} XP · ${tierConfig.label} on Whealth Factory. https://whealthfactory.com/u/${profile.username}`;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const blob = await generateBlob();
      if (!blob) throw new Error("no blob");
      const outcome = await saveImage(blob, `whealth-factory-${variant}.png`);
      if (outcome === "downloaded") toast.success("Story card downloaded!");
      else if (outcome === "shared") toast.success("Choose “Save Image” in the sheet to save to Photos");
      void track(FUNNEL.inviteShared, { method: "save", surface: "story", variant });
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate image");
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    setSharing(true);
    try {
      // Share the IMAGE itself — Instagram/WhatsApp only appear in the sheet
      // for a real file. The caption carries the invite link.
      const blob = await generateBlob();
      if (blob) {
        const outcome = await shareImage(blob, {
          filename: `whealth-factory-${variant}.png`,
          title: "Whealth Factory",
          text: shareCaption,
        });
        if (outcome === "downloaded") toast.success("Sharing isn't available here — image downloaded instead");
        if (outcome !== "cancelled") void track(FUNNEL.inviteShared, { method: "native", surface: "story", variant });
        return;
      }
      // Canvas failed → at least share the text + link.
      await shareText({ title: "Whealth Factory", text: shareCaption });
    } catch (err) {
      console.error(err);
      toast.error("Couldn't open sharing");
    } finally {
      setSharing(false);
    }
  };

  // Tier-dependent border glow color
  const cardBorderGlow = tier === 'legend' ? "border-[hsl(280_70%_60%)]/30" :
    tier === 'apex' ? "border-[hsl(18_95%_58%)]/30" :
    tier === 'elite' ? "border-gold/30" : "border-gold/15";

  return (
    <Portal>
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0" onClick={onClose}>
      <div className="absolute inset-0 bg-background/95" />

      <div className="relative flex flex-col items-center gap-3 w-full max-w-[320px]" onClick={(e) => e.stopPropagation()}>
        <button aria-label="Close" onClick={onClose} className="absolute -top-1 -right-1 z-10 p-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors">
          <X size={16} />
        </button>

        {/* Preview Card */}
        <div
          ref={cardRef}
          className={cn("w-full aspect-[3/4] rounded-2xl overflow-hidden relative border", cardBorderGlow)}
          style={{
            background: tier === 'legend' ? "linear-gradient(160deg, #1a0a2e, #0d1117, #1a0515)"
              : tier === 'apex' ? "linear-gradient(160deg, #1a0f08, #0d1117)"
              : tier === 'elite' ? "linear-gradient(160deg, #1a1508, #0a0c12)"
              : "linear-gradient(180deg, #0a0c12, #060810)",
          }}
        >
          {/* Top accent line */}
          <div
            className="absolute top-3.5 left-8 right-8 h-[3px] rounded-full"
            style={{
              background: tier === 'legend'
                ? "linear-gradient(90deg, transparent, hsl(280 70% 60% / 0.8), hsl(42 78% 54% / 0.9), hsl(350 80% 55% / 0.8), transparent)"
                : tier === 'apex'
                ? "linear-gradient(90deg, transparent, hsl(18 95% 58% / 0.9), hsl(42 78% 54% / 0.6), transparent)"
                : "linear-gradient(90deg, transparent, hsl(42 78% 54% / 0.8), transparent)",
            }}
          />

          {/* Bottom accent */}
          <div className="absolute bottom-3 left-8 right-8 h-[1px] bg-gradient-to-r from-transparent via-gold/20 to-transparent" />

          <div className="flex flex-col items-center justify-center h-full px-6 text-center">
            <p className="font-bold tracking-[0.22em] text-gold/80 mb-1 text-lg">WHEALTH FACTORY</p>
            <p className={cn(
              "font-black uppercase tracking-wider mb-4 text-[10px]",
              tier === 'legend' ? "text-[hsl(280_70%_60%)]" :
              tier === 'apex' ? "text-[hsl(18_95%_58%)]" :
              tier === 'elite' ? "text-gold" : "text-muted-foreground/40"
            )}>
              {tierConfig.emoji} {tierConfig.label}
            </p>

            {variant === "stats" && (
              <>
                <p className="font-extrabold text-foreground mb-2 text-2xl">@{profile.username}</p>
                <p className="font-black text-gold text-5xl drop-shadow-[0_0_20px_hsl(42_78%_54%/0.5)]">
                  {profile.xp.toLocaleString()}
                </p>
                <p className="font-bold tracking-widest text-gold/50 mb-6 text-xs">TOTAL XP</p>
                <div className="grid grid-cols-3 gap-2 w-full">
                  {[
                    { label: "STREAK", value: `${profile.streak}d`, emoji: "🔥" },
                    { label: "LEVEL", value: `${profile.level}`, emoji: "⚡" },
                    { label: "BEST", value: `${profile.longest_streak}d`, emoji: "🏆" },
                  ].map((s) => (
                    <div key={s.label} className="flex flex-col items-center">
                      <p className="font-black text-foreground text-lg">{s.emoji} {s.value}</p>
                      <p className="font-bold tracking-widest text-muted-foreground/30 text-[8px]">{s.label}</p>
                    </div>
                  ))}
                </div>
              </>
            )}

            {variant === "whealth" && whealthData && (
              <>
                <p className="font-extrabold text-foreground mb-2 text-xl">@{profile.username}</p>
                <p className="font-black text-gold text-6xl drop-shadow-[0_0_20px_hsl(42_78%_54%/0.5)] tabular-nums">
                  {whealthData.overall}
                </p>
                <p className="font-black tracking-widest text-gold/60 mb-5 text-[11px]">WHEALTH INDEX / 100</p>
                <div className="flex items-end justify-center gap-2 h-12 mb-1">
                  {([["SLP","sleep"],["RCV","recovery"],["MOV","movement"],["NUT","nutrition"],["MND","mind"],["INR","inner"]] as const).map(([label, key]) => {
                    const v = whealthData.pillars[key];
                    return (
                      <div key={key} className="flex flex-col items-center gap-1">
                        <div className="w-6 h-11 bg-white/10 rounded-sm overflow-hidden flex items-end">
                          {v != null && (
                            <div
                              className={cn("w-full", v >= 75 ? "bg-gold" : v >= 50 ? "bg-gold/70" : "bg-[hsl(18_95%_58%/0.85)]")}
                              style={{ height: `${Math.max(6, v)}%` }}
                            />
                          )}
                        </div>
                        <p className="text-[7px] font-extrabold tracking-wider text-white/35">{label}</p>
                      </div>
                    );
                  })}
                </div>
                <p className="text-muted-foreground/30 font-semibold mt-3 text-[9px] tracking-wider">
                  COMPUTED FROM ALL MY DATA
                </p>
              </>
            )}

            {variant === "streak" && (
              <>
                <p className="font-extrabold text-foreground mb-3 text-xl">@{profile.username}</p>
                <p className="text-7xl drop-shadow-[0_0_25px_hsl(18_95%_58%/0.5)]">🔥</p>
                <p className="font-black text-gold mt-2 text-5xl drop-shadow-[0_0_15px_hsl(42_78%_54%/0.4)]">
                  {profile.streak}
                </p>
                <p className="font-black text-gold/70 tracking-wider text-base">DAY STREAK</p>
                <p className="text-muted-foreground/40 font-bold mt-2 text-xs">
                  {profile.streak >= 30 ? "MOST FAIL BEFORE THIS →" : profile.streak >= 7 ? "DON'T BREAK NOW →" : "BEAT MY STREAK →"}
                </p>
                <p className="text-muted-foreground/25 mt-1 text-sm">Best: {profile.longest_streak} days</p>
              </>
            )}

            {variant === "badge" && badgeData && (
              <>
                <p className="font-extrabold text-foreground mb-3 text-xl">@{profile.username}</p>
                <p className={cn(
                  "text-6xl",
                  badgeData.rarity === 'legendary' && "drop-shadow-[0_0_25px_hsl(42_78%_54%/0.6)]",
                  badgeData.rarity === 'epic' && "drop-shadow-[0_0_25px_hsl(280_70%_60%/0.5)]"
                )}>
                  {badgeData.icon}
                </p>
                <p className="font-extrabold text-foreground mt-3 text-lg">{badgeData.name}</p>
                <p className={cn(
                  "font-bold tracking-widest mt-1 text-xs",
                  badgeData.rarity === 'legendary' ? "text-gold" :
                  badgeData.rarity === 'epic' ? "text-[hsl(280_70%_60%)]" :
                  badgeData.rarity === 'rare' ? "text-[hsl(217_91%_60%)]" : "text-muted-foreground/40"
                )}>
                  {badgeData.rarity.toUpperCase()}
                </p>
                {badgeData.rarity === 'legendary' && (
                  <p className="text-gold/40 font-semibold mt-2 text-[10px]">ONLY TOP 1% EARN THIS</p>
                )}
              </>
            )}

            {variant === "referral" && (() => {
              const code = (referralCode || profile.username).toUpperCase();
              // Autofit: long codes shrink instead of wrapping mid-code.
              const codeSize = Math.max(12, Math.min(20, Math.floor(236 / (code.length * 0.66))));
              return (
                <>
                  <div className="relative mb-4">
                    <div className="absolute inset-0 -m-2 rounded-full bg-gold/20 blur-xl" aria-hidden />
                    <BrandLogo size={48} className="relative rounded-xl shadow-[0_4px_18px_hsl(var(--gold)/0.5)]" alt="" />
                  </div>
                  <p className="font-extrabold text-foreground text-2xl">Train with me.</p>
                  <p className="text-muted-foreground/60 text-xs mb-5">@{profile.username} on Whealth Factory</p>
                  <div className="w-full rounded-xl border border-gold/50 bg-gradient-to-br from-gold/[0.14] to-gold/[0.05] px-4 py-3 mb-4 shadow-[0_0_24px_-8px_hsl(var(--gold)/0.4)]">
                    <p className="text-[10px] font-bold tracking-[0.22em] text-gold/60 mb-1">YOUR INVITE CODE</p>
                    <p
                      className="font-display font-black text-gold tracking-wide leading-none whitespace-nowrap drop-shadow-[0_0_10px_hsl(var(--gold)/0.35)]"
                      style={{ fontSize: `${codeSize}px` }}
                    >
                      {code}
                    </p>
                  </div>
                  <p className="text-muted-foreground/50 text-[11px]">AI coach · daily check-ins · the full system</p>
                </>
              );
            })()}

            {variant === "referral" ? (
              <p className="absolute bottom-4 text-gold/40 font-bold tracking-[0.22em] text-[10px]">
                USE MY CODE AT SIGN-UP
              </p>
            ) : (
              <p className="absolute bottom-4 text-muted-foreground/20 font-semibold tracking-[0.22em] text-xl">
                DISCIPLINE IS THE NEW FLEX
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 w-full pb-safe">
          <Button variant="ember" size="default" className="flex-1" onClick={handleDownload} disabled={downloading}>
            <Download size={16} />
            {downloading ? "Saving..." : "Save Image"}
          </Button>
          <Button variant="gold-outline" size="default" className="flex-1" onClick={handleShare} disabled={sharing}>
            <Share2 size={16} />
            {sharing ? "Opening…" : "Share"}
          </Button>
        </div>
      </div>
    </div>
    </Portal>
  );
};

export default StoryShareModal;
