import { Bell, Flame, Trophy } from "lucide-react";
import { BottomSheet } from "@/components/ui/sheet-bottom";
import { Button } from "@/components/ui/button";
import { hapticSelection } from "@/lib/haptics";

interface PushPrimingSheetProps {
  open: boolean;
  onEnable: () => void;
  onDismiss: () => void;
}

const ROWS = [
  { icon: Flame, text: "A nudge in the evening if you haven't checked in yet" },
  { icon: Trophy, text: "Milestones, rank-ups & when a friend passes you" },
  { icon: Bell, text: "Your coach's one-line morning cue" },
];

/**
 * In-app rationale shown BEFORE the iOS notification prompt. A cold OS prompt
 * that a user reflexively denies is permanent and kills the entire retention
 * push engine — so we explain the value first and only fire the real prompt
 * when they tap "Turn on reminders". The shell (rise, scrim, scroll lock,
 * exit) is BottomSheet's; this file owns only the argument.
 */
export default function PushPrimingSheet({ open, onEnable, onDismiss }: PushPrimingSheetProps) {
  const dismiss = () => { hapticSelection(); onDismiss(); };
  return (
    <BottomSheet open={open} onClose={dismiss} label="Turn on reminders" bodyClassName="px-6">
      <div className="mx-auto mt-2 mb-4 flex h-16 w-16 items-center justify-center rounded-2xl gradient-gold glow-gold">
        <Bell size={30} className="text-primary-foreground" strokeWidth={2.2} aria-hidden />
      </div>

      <h2 className="text-center font-display text-2xl font-black tracking-tight">
        Never break the chain
      </h2>
      <p className="mx-auto mt-2 mb-5 max-w-[300px] text-center text-sm text-muted-foreground">
        Turn on reminders so a busy day never costs you your streak. You stay in control — only what matters.
      </p>

      <ul className="mb-6 divide-y divide-border/35">
        {ROWS.map(({ icon: Icon, text }, i) => (
          <li key={i} className="flex items-center gap-3 py-3">
            <Icon size={17} className="text-gold shrink-0" aria-hidden />
            <p className="text-sm text-foreground/90 leading-snug">{text}</p>
          </li>
        ))}
      </ul>

      <Button variant="ember" size="xl" className="w-full" onClick={() => { hapticSelection(); onEnable(); }}>
        <Bell size={18} aria-hidden /> Turn on reminders
      </Button>
      <Button variant="ghost" size="lg" className="w-full mt-1 text-muted-foreground" onClick={dismiss}>
        Maybe later
      </Button>
    </BottomSheet>
  );
}
