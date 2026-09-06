// Per-event icons for onboarding cards — UI layer only, so the pure
// registry (src/lib/onboarding) stays free of React component imports.
import {
  Flame,
  Lock,
  Zap,
  TrendingUp,
  Sparkles,
  ListChecks,
  Users,
  Trophy,
  Shield,
  Dumbbell,
  ClipboardList,
  CircleCheck,
  type LucideIcon,
} from "lucide-react";
import type { OnboardingEventId } from "@/lib/onboarding/types";

export const EVENT_ICONS: Record<OnboardingEventId, LucideIcon> = {
  TODAY_INTRO: Flame,
  CHECKIN_INTRO: Lock,
  XP_INTRO: Zap,
  STREAK_INTRO: Flame,
  STREAK_SHIELD_INTRO: Shield,
  PROGRESSION_INTRO: TrendingUp,
  AI_COACH_INTRO: Sparkles,
  COACH_MISSION_INTRO: ListChecks,
  SQUAD_INTRO: Users,
  RANKS_INTRO: Trophy,
  TRAINING_PROGRAM_READY: ClipboardList,
  FIRST_WORKOUT_INTRO: Dumbbell,
  WORKOUT_LOGGING_INTRO: Dumbbell,
  WORKOUT_COMPLETE_INTRO: CircleCheck,
  PROGRAM_ADAPTS_INTRO: TrendingUp,
};
