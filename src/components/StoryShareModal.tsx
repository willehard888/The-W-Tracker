import { useRef, useState } from "react";
import { Download, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

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

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setDownloading(true);

    try {
      // Use html2canvas-style approach via canvas API
      const card = cardRef.current;
      const canvas = document.createElement("canvas");
      const scale = 3;
      canvas.width = card.offsetWidth * scale;
      canvas.height = card.offsetHeight * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(scale, scale);

      // Draw background
      const gradient = ctx.createLinearGradient(0, 0, 0, card.offsetHeight);
      gradient.addColorStop(0, "#0a0c12");
      gradient.addColorStop(1, "#060810");
      ctx.fillStyle = gradient;
      ctx.roundRect(0, 0, card.offsetWidth, card.offsetHeight, 24);
      ctx.fill();

      // Gold accent line at top
      const goldGrad = ctx.createLinearGradient(0, 0, card.offsetWidth, 0);
      goldGrad.addColorStop(0, "rgba(202, 158, 62, 0)");
      goldGrad.addColorStop(0.5, "rgba(202, 158, 62, 0.8)");
      goldGrad.addColorStop(1, "rgba(202, 158, 62, 0)");
      ctx.fillStyle = goldGrad;
      ctx.fillRect(40, 16, card.offsetWidth - 80, 2);

      // Title
      ctx.fillStyle = "rgba(202, 158, 62, 0.9)";
      ctx.font = "bold 11px 'Inter', system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.letterSpacing = "4px";
      ctx.fillText("THE W TRACKER", card.offsetWidth / 2, 46);

      if (variant === "stats") {
        // Username
        ctx.fillStyle = "#f0ece4";
        ctx.font = "800 28px 'Space Grotesk', system-ui, sans-serif";
        ctx.fillText(`@${profile.username}`, card.offsetWidth / 2, 100);

        // XP
        ctx.fillStyle = "rgba(202, 158, 62, 1)";
        ctx.font = "900 52px 'Space Grotesk', system-ui, sans-serif";
        ctx.fillText(`${profile.xp.toLocaleString()}`, card.offsetWidth / 2, 172);
        ctx.fillStyle = "rgba(202, 158, 62, 0.5)";
        ctx.font = "bold 14px 'Inter', system-ui, sans-serif";
        ctx.fillText("TOTAL XP", card.offsetWidth / 2, 196);

        // Stats row
        const statsY = 244;
        const stats = [
          { label: "STREAK", value: `${profile.streak}d` },
          { label: "LEVEL", value: `${profile.level}` },
          { label: "BEST", value: `${profile.longest_streak}d` },
        ];
        const colW = card.offsetWidth / 3;
        stats.forEach((s, i) => {
          const x = colW * i + colW / 2;
          ctx.fillStyle = "#f0ece4";
          ctx.font = "900 24px 'Space Grotesk', system-ui, sans-serif";
          ctx.fillText(s.value, x, statsY);
          ctx.fillStyle = "rgba(255,255,255,0.35)";
          ctx.font = "bold 9px 'Inter', system-ui, sans-serif";
          ctx.fillText(s.label, x, statsY + 18);
        });

        // Tagline
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.font = "600 10px 'Inter', system-ui, sans-serif";
        ctx.fillText("DISCIPLINE IS THE NEW FLEX", card.offsetWidth / 2, 310);

      } else if (variant === "streak") {
        ctx.fillStyle = "#f0ece4";
        ctx.font = "800 24px 'Space Grotesk', system-ui, sans-serif";
        ctx.fillText(`@${profile.username}`, card.offsetWidth / 2, 90);

        // Fire emoji
        ctx.font = "60px serif";
        ctx.fillText("🔥", card.offsetWidth / 2, 170);

        ctx.fillStyle = "rgba(202, 158, 62, 1)";
        ctx.font = "900 48px 'Space Grotesk', system-ui, sans-serif";
        ctx.fillText(`${profile.streak} DAY`, card.offsetWidth / 2, 230);
        ctx.font = "900 28px 'Space Grotesk', system-ui, sans-serif";
        ctx.fillText("STREAK", card.offsetWidth / 2, 262);

        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.font = "bold 11px 'Inter', system-ui, sans-serif";
        ctx.fillText("BEAT MY STREAK →", card.offsetWidth / 2, 310);

      } else if (variant === "badge" && badgeData) {
        ctx.fillStyle = "#f0ece4";
        ctx.font = "800 22px 'Space Grotesk', system-ui, sans-serif";
        ctx.fillText(`@${profile.username}`, card.offsetWidth / 2, 86);

        ctx.font = "56px serif";
        ctx.fillText(badgeData.icon, card.offsetWidth / 2, 166);

        ctx.fillStyle = "#f0ece4";
        ctx.font = "800 22px 'Space Grotesk', system-ui, sans-serif";
        ctx.fillText(badgeData.name, card.offsetWidth / 2, 216);

        ctx.fillStyle = "rgba(202, 158, 62, 0.8)";
        ctx.font = "bold 10px 'Inter', system-ui, sans-serif";
        ctx.fillText(badgeData.rarity.toUpperCase(), card.offsetWidth / 2, 238);

        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.font = "600 10px 'Inter', system-ui, sans-serif";
        ctx.fillText("BADGE UNLOCKED", card.offsetWidth / 2, 310);
      }

      // Convert to blob and download
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
    if (!cardRef.current) return;

    // Try native share with text fallback
    if (navigator.share) {
      try {
        await navigator.share({
          title: "The W Tracker",
          text: variant === "streak"
            ? `🔥 ${profile.streak}-day streak on The W Tracker. Beat my streak!`
            : variant === "badge" && badgeData
            ? `Just unlocked the ${badgeData.name} badge on The W Tracker! ${badgeData.icon}`
            : `${profile.xp.toLocaleString()} XP on The W Tracker. Level ${profile.level}. The grind doesn't stop.`,
          url: window.location.origin,
        });
      } catch {}
    } else {
      handleDownload();
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center px-6" onClick={onClose}>
      <div className="absolute inset-0 bg-background/90 backdrop-blur-md" />

      <div className="relative flex flex-col items-center gap-4 w-full max-w-[320px]" onClick={(e) => e.stopPropagation()}>
        {/* Close */}
        <button onClick={onClose} className="absolute -top-2 -right-2 z-10 p-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors">
          <X size={16} />
        </button>

        {/* Preview Card */}
        <div
          ref={cardRef}
          className="w-full aspect-[9/16] max-h-[340px] rounded-2xl overflow-hidden relative"
          style={{
            background: "linear-gradient(180deg, #0a0c12, #060810)",
          }}
        >
          {/* Gold top accent */}
          <div className="absolute top-4 left-10 right-10 h-0.5 bg-gradient-to-r from-transparent via-gold/80 to-transparent" />

          <div className="flex flex-col items-center justify-center h-full px-6 text-center">
            <p className="text-[9px] font-bold tracking-[0.3em] text-gold/80 mb-4">THE W TRACKER</p>

            {variant === "stats" && (
              <>
                <p className="font-display text-lg font-black text-foreground mb-4">@{profile.username}</p>
                <p className="font-display text-4xl font-black text-gold glow-gold-text mb-0.5">
                  {profile.xp.toLocaleString()}
                </p>
                <p className="text-[10px] text-gold/50 font-bold tracking-wider mb-5">TOTAL XP</p>
                <div className="flex gap-6">
                  {[
                    { v: `${profile.streak}d`, l: "STREAK" },
                    { v: `${profile.level}`, l: "LEVEL" },
                    { v: `${profile.longest_streak}d`, l: "BEST" },
                  ].map((s) => (
                    <div key={s.l} className="text-center">
                      <p className="font-display text-lg font-black">{s.v}</p>
                      <p className="text-[8px] text-muted-foreground font-bold tracking-wider">{s.l}</p>
                    </div>
                  ))}
                </div>
              </>
            )}

            {variant === "streak" && (
              <>
                <p className="font-display text-base font-black text-foreground mb-3">@{profile.username}</p>
                <p className="text-4xl mb-2">🔥</p>
                <p className="font-display text-3xl font-black text-gold glow-gold-text">{profile.streak} DAY</p>
                <p className="font-display text-xl font-black text-gold/80">STREAK</p>
                <p className="text-[10px] text-muted-foreground/50 font-semibold mt-4">BEAT MY STREAK →</p>
              </>
            )}

            {variant === "badge" && badgeData && (
              <>
                <p className="font-display text-base font-black text-foreground mb-3">@{profile.username}</p>
                <p className="text-4xl mb-2">{badgeData.icon}</p>
                <p className="font-display text-lg font-black">{badgeData.name}</p>
                <p className="text-[9px] font-bold tracking-[0.2em] text-gold/70 mt-1">{badgeData.rarity.toUpperCase()}</p>
                <p className="text-[10px] text-muted-foreground/40 font-semibold mt-4">BADGE UNLOCKED</p>
              </>
            )}

            <p className="absolute bottom-4 text-[8px] text-muted-foreground/30 font-semibold tracking-widest">
              DISCIPLINE IS THE NEW FLEX
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 w-full">
          <Button variant="gold" size="lg" className="flex-1" onClick={handleDownload} disabled={downloading}>
            <Download size={16} />
            {downloading ? "Saving..." : "Save Image"}
          </Button>
          <Button variant="gold-outline" size="lg" className="flex-1" onClick={handleShare}>
            <Share2 size={16} />
            Share
          </Button>
        </div>
      </div>
    </div>
  );
};

export default StoryShareModal;
