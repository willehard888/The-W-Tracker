import { useEffect } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { hapticNotification } from "@/lib/haptics";

/**
 * Styled destructive-confirm — replaces window.confirm(), whose grey system
 * alert mid-flow was the one un-branded surface left in the tribe screens.
 * Same anatomy as Profile's delete-account dialog, minus the type-to-confirm
 * (these actions are smaller and reversible by recreating).
 *
 * `tone="neutral"` for a confirm that loses nothing (finish a session early,
 * add estimated items anyway): red there cried wolf beside "your sets are saved".
 *
 * A destructive confirm announces itself with the warning haptic as it opens
 * — the one place, so no call site has to remember.
 */
const ConfirmDialog = ({
  open,
  onOpenChange,
  title,
  description,
  actionLabel = "Delete",
  tone = "destructive",
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  actionLabel?: string;
  tone?: "destructive" | "neutral";
  onConfirm: () => void;
}) => {
  useEffect(() => {
    if (open && tone === "destructive") void hapticNotification("warning");
  }, [open, tone]);
  return (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction
          className={tone === "destructive"
            ? "[background:hsl(var(--destructive))] text-destructive-foreground [text-shadow:none] before:hidden after:hidden shadow-[var(--shadow-2)] hover:shadow-[var(--shadow-2)] hover:brightness-110"
            : undefined}
          onClick={onConfirm}
        >
          {actionLabel}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
  );
};

export default ConfirmDialog;
