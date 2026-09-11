import { useState } from "react";
import { Crown, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { friendlyError } from "@/lib/error-copy";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";

const REASON_COPY: Record<string, string> = {
  invalid_code: "That code doesn't exist.",
  code_used: "This invite has already been redeemed.",
  code_expired: "This invite has expired.",
  empty_code: "Enter a code first.",
  already_legend: "You're already a Legend.",
  not_authenticated: "Sign in to redeem.",
};

interface Props {
  trigger?: React.ReactNode;
}

/** A centered code entry: the one tribe surface that stays a dialog. */
export const RedeemLegendInviteDialog = ({ trigger }: Props) => {
  const { refreshProfile, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const isLegend = profile?.status_tier === "legend" || profile?.legend_pinned;

  const redeem = async () => {
    if (!code.trim()) {
      toast.error("Enter your invite code");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("redeem_legend_invite", {
        p_code: code.trim(),
      });
      if (error) throw error;
      const result = data as any;
      if (!result?.success) {
        toast.error(REASON_COPY[result?.reason] ?? "Could not redeem code");
        return;
      }
      toast.success("Welcome to the Legend tier 🔱", {
        description: "Your status has been pinned.",
      });
      setOpen(false);
      setCode("");
      await refreshProfile();
    } catch (e: any) {
      toast.error(friendlyError(e, "Failed to redeem"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="gold-outline" size="sm" className="min-h-11">
            <Crown aria-hidden size={14} fill="currentColor" />
            Redeem Legend invite
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="border-gold/30">
        <DialogHeader>
          <div className="mx-auto mb-2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-gold/15 border border-gold/30">
            <Crown className="h-6 w-6 text-gold" fill="currentColor" aria-hidden />
          </div>
          <DialogTitle className="text-center font-display text-xl">
            Legend is invite-only
          </DialogTitle>
          <DialogDescription className="text-center">
            The Legend tier cannot be earned through XP or streaks. Enter your private invite code below.
          </DialogDescription>
        </DialogHeader>

        {isLegend ? (
          <div className="text-center py-4">
            <Sparkles className="h-8 w-8 mx-auto mb-2 text-gold" aria-hidden />
            <p className="font-bold">You are already a Legend.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="LEGEND-XXXX"
              className="font-mono tracking-wider text-center uppercase h-11"
              maxLength={40}
              autoFocus
            />
            <Button onClick={redeem} loading={loading} variant="tier" className="w-full min-h-11">
              <Crown aria-hidden className="h-4 w-4" fill="currentColor" />
              Redeem and ascend to Legend
            </Button>
            <p className="text-[12px] text-center text-muted-foreground">
              Codes are single-use. Once redeemed, your status is locked at Legend permanently.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
