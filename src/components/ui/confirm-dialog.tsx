import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Styled destructive-confirm — replaces window.confirm(), whose grey system
 * alert mid-flow was the one un-branded surface left in the tribe screens.
 * Same anatomy as Profile's delete-account dialog, minus the type-to-confirm
 * (these actions are smaller and reversible by recreating).
 */
const ConfirmDialog = ({
  open,
  onOpenChange,
  title,
  description,
  actionLabel = "Delete",
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  actionLabel?: string;
  onConfirm: () => void;
}) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction
          className="[background:hsl(var(--destructive))] text-destructive-foreground [text-shadow:none] before:hidden after:hidden shadow-[var(--shadow-2)] hover:shadow-[var(--shadow-2)] hover:brightness-110"
          onClick={onConfirm}
        >
          {actionLabel}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

export default ConfirmDialog;
