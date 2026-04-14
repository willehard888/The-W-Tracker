import { useRef, useState } from "react";
import { Download, Share2, X, Flame, Zap, Trophy, Crown, Sparkles, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { getTierConfig } from "@/lib/status-tiers";

interface StoryShareModalProps {
  open: boolean;
  onClose: () => void;
  variant?: "stats" | "badge" | "streak";
  badgeData?: { name: string; icon: string; rarity: string };
}

const StoryShareModal = ({ open, onClose, variant = "stats", badgeData }: StoryShareModalProps) => {
  const { profile } = useAuth();
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  if (!open || !profile) return null;

  const tier = profile.status_tier || 'recruit';
  const tierConfig = getTierConfig(tier);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setDownloading(true);

    try {
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
      ctx.fillText("THE W TRACKER", card.offsetWidth / 2, 44);

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
        ctx.fillStyle = "#f0ece4";
        ctx.font = "800 22px 'Space Grotesk', system-ui, sans-serif";
        ctx.fillText(`@${profile.username}`, card.offsetWidth / 2, 92);

        // Large fire with glow
        ctx.font = "72px serif";
        ctx.shadowColor = "rgba(235, 87, 27, 0.5)";
        ctx.shadowBlur = 30;
        ctx.fillText("🔥", card.offsetWidth / 2, 175);
        ctx.shadowBlur = 0;

        ctx.shadowColor = "rgba(202, 158, 62, 0.4)";
        ctx.shadowBlur = 15;
        ctx.fillStyle = "rgba(202, 158, 62, 1)";
        ctx.font = "900 52px 'Space Grotesk', system-ui, sans-serif";
        ctx.fillText(`${profile.streak}`, card.offsetWidth / 2, 232);
        ctx.shadowBlur = 0;

        ctx.fillStyle = "rgba(202, 158, 62, 0.7)";
        ctx.font = "900 18px 'Space Grotesk', system-ui, sans-serif";
        ctx.fillText("DAY STREAK", card.offsetWidth / 2, 256);

        // Pressure text
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.font = "bold 10px 'Inter', system-ui, sans-serif";
        ctx.fillText(
          profile.streak >= 30 ? "MOST FAIL BEFORE THIS →" :
          profile.streak >= 7 ? "DON'T BREAK NOW →" :
          "BEAT MY STREAK →",
          card.offsetWidth / 2, 295
        );

        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.font = "600 8px 'Inter', system-ui, sans-serif";
        ctx.fillText(`Best: ${profile.longest_streak} days`, card.offsetWidth / 2, cardH - 30);

      } else if (variant === "badge" && badgeData) {
        ctx.fillStyle = "#f0ece4";
        ctx.font = "800 22px 'Space Grotesk', system-ui, sans-serif";
        ctx.fillText(`@${profile.username}`, card.offsetWidth / 2, 86);

        ctx.font = "64px serif";
        ctx.shadowColor = badgeData.rarity === 'legendary' ? "rgba(202, 158, 62, 0.6)" :
                          badgeData.rarity === 'epic' ? "rgba(138, 79, 255, 0.5)" : "rgba(0,0,0,0)";
        ctx.shadowBlur = badgeData.rarity === 'legendary' || badgeData.rarity === 'epic' ? 25 : 0;
        ctx.fillText(badgeData.icon, card.offsetWidth / 2, 170);
        ctx.shadowBlur = 0;

        ctx.fillStyle = "#f0ece4";
        ctx.font = "800 20px 'Space Grotesk', system-ui, sans-serif";
        ctx.fillText(badgeData.name, card.offsetWidth / 2, 216);

        const rarityColor = badgeData.rarity === 'legendary' ? "rgba(202, 158, 62, 0.9)" :
                           badgeData.rarity === 'epic' ? "rgba(138, 79, 255, 0.9)" :
                           badgeData.rarity === 'rare' ? "rgba(59, 130, 246, 0.9)" :
                           "rgba(255,255,255,0.4)";
        ctx.fillStyle = rarityColor;
        ctx.font = "bold 10px 'Inter', system-ui, sans-serif";
        ctx.fillText(badgeData.rarity.toUpperCase(), card.offsetWidth / 2, 238);

        if (badgeData.rarity === 'legendary') {
          ctx.fillStyle = "rgba(202, 158, 62, 0.3)";
          ctx.font = "600 9px 'Inter', system-ui, sans-serif";
          ctx.fillText("ONLY TOP 1% EARN THIS", card.offsetWidth / 2, 260);
        }

        ctx.fillStyle = "rgba(255,255,255,0.2)";
        ctx.font = "600 9px 'Inter', system-ui, sans-serif";
        ctx.fillText("BADGE UNLOCKED", card.offsetWidth / 2, cardH - 30);
      }

      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `w-tracker-${variant}.png`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Story card downloaded!");
        setDownloading(false);
      }, "image/png");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate image");
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "The W Tracker",
          text: variant === "streak"
            ? `🔥 ${profile.streak}-day streak on The W Tracker. ${profile.streak >= 30 ? "Most fail before this." : "Beat my streak!"}`
            : variant === "badge" && badgeData
            ? `Just unlocked ${badgeData.name} ${badgeData.icon} (${badgeData.rarity.toUpperCase()}) on The W Tracker!`
            : `${profile.xp.toLocaleString()} XP • Level ${profile.level} • ${tierConfig.emoji} ${tierConfig.label} on The W Tracker. The grind doesn't stop.`,
          url: window.location.origin,
        });
      } catch {}
    } else {
      handleDownload();
    }
  };

  // Tier-dependent border glow color
  const cardBorderGlow = tier === 'legend' ? "border-[hsl(280_70%_60%)]/30" :
    tier === 'apex' ? "border-[hsl(18_95%_58%)]/30" :
    tier === 'elite' ? "border-gold/30" : "border-gold/15";

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0" onClick={onClose}>
      <div className="absolute inset-0 bg-background/90 backdrop-blur-md" />

      <div className="relative flex flex-col items-center gap-3 w-full max-w-[320px]" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-1 -right-1 z-10 p-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors">
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
            <p className="text-[10px] font-bold tracking-[0.3em] text-gold/80 mb-1">THE W TRACKER</p>
            <p className={cn(
              "text-[9px] font-black tracking-[0.2em] mb-3",
              tier === 'legend' ? "text-[hsl(280_70%_65%)]" :
              tier === 'apex' ? "text-[hsl(18_95%_58%)]" :
              tier === 'elite' ? "text-gold" : "text-muted-foreground/50"
            )}>
              {tierConfig.emoji} {tierConfig.label.toUpperCase()}
            </p>

            {variant === "stats" && (
              <>
                <p className="font-display text-lg font-black text-foreground mb-3">@{profile.username}</p>
                <p className={cn(
                  "font-display text-4xl font-black mb-0.5",
                  tier === 'legend' ? "bg-gradient-to-r from-[hsl(280_70%_65%)] via-gold to-[hsl(350_80%_60%)] bg-clip-text text-transparent" :
                  "text-gold glow-gold-text"
                )}>
                  {profile.xp.toLocaleString()}
                </p>
                <p className="text-[10px] text-gold/50 font-bold tracking-wider mb-5">TOTAL XP</p>
                <div className="flex gap-5">
                  {[
                    { v: `🔥 ${profile.streak}d`, l: "STREAK" },
                    { v: `⚡ ${profile.level}`, l: "LEVEL" },
                    { v: `🏆 ${profile.longest_streak}d`, l: "BEST" },
                  ].map((s) => (
                    <div key={s.l} className="text-center">
                      <p className="font-display text-sm font-black">{s.v}</p>
                      <p className="text-[7px] text-muted-foreground font-bold tracking-wider">{s.l}</p>
                    </div>
                  ))}
                </div>
              </>
            )}

            {variant === "streak" && (
              <>
                <p className="font-display text-base font-black text-foreground mb-2">@{profile.username}</p>
                <p className="text-4xl mb-1" style={{ filter: "drop-shadow(0 0 20px rgba(235, 87, 27, 0.5))" }}>🔥</p>
                <p className={cn(
                  "font-display text-4xl font-black",
                  tier === 'legend' ? "bg-gradient-to-r from-[hsl(280_70%_65%)] via-gold to-[hsl(350_80%_60%)] bg-clip-text text-transparent" :
                  "text-gold glow-gold-text"
                )}>
                  {profile.streak}
                </p>
                <p className="font-display text-lg font-black text-gold/80">DAY STREAK</p>
                <p className="text-[9px] text-muted-foreground/40 font-bold mt-2">
                  {profile.streak >= 30 ? "MOST FAIL BEFORE THIS →" : profile.streak >= 7 ? "DON'T BREAK NOW →" : "BEAT MY STREAK →"}
                </p>
                <p className="text-[8px] text-muted-foreground/25 mt-1">Best: {profile.longest_streak} days</p>
              </>
            )}

            {variant === "badge" && badgeData && (
              <>
                <p className="font-display text-base font-black text-foreground mb-2">@{profile.username}</p>
                <p className="text-4xl mb-2" style={{
                  filter: badgeData.rarity === 'legendary' ? "drop-shadow(0 0 20px rgba(202, 158, 62, 0.6))" :
                          badgeData.rarity === 'epic' ? "drop-shadow(0 0 15px rgba(138, 79, 255, 0.5))" : "none",
                }}>{badgeData.icon}</p>
                <p className="font-display text-lg font-black">{badgeData.name}</p>
                <p className={cn(
                  "text-[9px] font-bold tracking-[0.2em] mt-1",
                  badgeData.rarity === 'legendary' ? "text-gold" :
                  badgeData.rarity === 'epic' ? "text-[hsl(275_80%_60%)]" :
                  badgeData.rarity === 'rare' ? "text-[hsl(210_90%_56%)]" : "text-muted-foreground/60"
                )}>{badgeData.rarity.toUpperCase()}</p>
                {badgeData.rarity === 'legendary' && (
                  <p className="text-[8px] text-gold/40 mt-1.5 font-semibold">ONLY TOP 1% EARN THIS</p>
                )}
                <p className="text-[9px] text-muted-foreground/30 font-semibold mt-4">BADGE UNLOCKED</p>
              </>
            )}

            <p className="absolute bottom-4 text-[7px] text-muted-foreground/20 font-semibold tracking-[0.3em]">
              DISCIPLINE IS THE NEW FLEX
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 w-full pb-safe">
          <Button variant="gold" size="default" className="flex-1" onClick={handleDownload} disabled={downloading}>
            <Download size={16} />
            {downloading ? "Saving..." : "Save Image"}
          </Button>
          <Button variant="gold-outline" size="default" className="flex-1" onClick={handleShare}>
            <Share2 size={16} />
            Share
          </Button>
        </div>
      </div>
    </div>
  );
};

export default StoryShareModal;
