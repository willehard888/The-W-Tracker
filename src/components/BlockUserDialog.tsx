import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * In-app Block confirmation (UserProfile + Chat). Replaces window.confirm(),
 * which webviews and the browser preview suppress — the tap silently did
 * nothing. App Store 1.2 safety flow, so the confirm must always render.
 */
const BlockUserDialog = ({
  open,
  username,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  username?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Block @{username || "this user"}?</AlertDialogTitle>
        <AlertDialogDescription>
          You won't see each other's content and they can't message or friend
          you. You can unblock anytime in Settings → Blocked users.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction
          onClick={onConfirm}
          // The default variant paints PRIMARY_EMBER via an arbitrary
          // [background:linear-gradient…] + ::before/::after sheen layers, so a
          // plain bg-destructive loses. Override the same property + hide the layers.
          className="[background:hsl(var(--destructive))] text-destructive-foreground [text-shadow:none] before:hidden after:hidden shadow-[var(--shadow-2)] hover:shadow-[var(--shadow-2)] hover:brightness-110"
        >
          Block
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

export default BlockUserDialog;
