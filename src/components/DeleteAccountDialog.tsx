import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * The one account-deletion dialog: type the username, then the edge function
 * takes the account and its data (delete-account). Opened from Profile →
 * Settings, and from the paywall's footer — a member who signed up and never
 * started the trial is gated to /paywall and must still be able to leave
 * (App Review 5.1.1(v)). Both doors converge here so the copy and the
 * confirmation never drift.
 */
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  username: string | null | undefined;
  /** Called with true while the deletion runs — the opener can dim its button. */
  onBusy?: (busy: boolean) => void;
}

const DeleteAccountDialog = ({ open, onOpenChange, username, onBusy }: Props) => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const close = (next: boolean) => { onOpenChange(next); if (!next) setConfirmText(""); };

  // Gated behind the typed username so a single accidental tap can never
  // wipe the member's data.
  const performDeletion = async () => {
    onOpenChange(false);
    setDeleting(true); onBusy?.(true);
    try {
      const { error } = await supabase.functions.invoke("delete-account");
      if (error) throw error;
      await signOut();
      toast.success("Account deleted");
      navigate("/landing", { replace: true });
    } catch {
      toast.error("Couldn't delete account");
    } finally {
      setDeleting(false); onBusy?.(false); setConfirmText("");
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={close}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete your account?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes your account, profile, posts,
            check-ins, and habit data. If you have an active
            subscription, cancel it first from subscription management
            so billing stops correctly.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 py-1">
          <p className="text-xs text-muted-foreground">
            Type your username{" "}
            <span className="font-bold text-foreground">{username}</span>{" "}
            to confirm.
          </p>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={username ?? "username"}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep account</AlertDialogCancel>
          <AlertDialogAction
            className="[background:hsl(var(--destructive))] text-destructive-foreground [text-shadow:none] before:hidden after:hidden shadow-[var(--shadow-2)] hover:shadow-[var(--shadow-2)] hover:brightness-110"
            onClick={performDeletion}
            disabled={deleting || !username || confirmText.trim() !== username}
          >
            {deleting ? "Deleting…" : "Delete permanently"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteAccountDialog;
