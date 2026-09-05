import { useLocation } from "react-router-dom";
import {
  Block,
  FeedSkeleton,
  HomeSkeleton,
  LeaderboardSkeleton,
  ListSkeleton,
  NutritionSkeleton,
  ProfileSkeleton,
  SettingsSkeleton,
  SubPageSkeleton,
} from "@/components/skeletons/PageSkeleton";
import CheckinSkeleton from "@/components/checkin/CheckinSkeleton";
import CoachSkeleton from "@/components/coach/CoachSkeleton";

/**
 * Suspense fallback for lazy routes — a skeleton matched to the destination
 * screen's layout so the route swap is visually continuous (no generic
 * loading flash). Every route family maps to a silhouette; unknown routes
 * get the sub-page one — never a blank screen or a spinner.
 */
const RouteFallback = () => {
  const { pathname } = useLocation();
  const is = (...prefixes: string[]) => prefixes.some((p) => pathname.startsWith(p));

  if (pathname === "/") return <HomeSkeleton />;
  if (is("/checkin")) return <CheckinSkeleton />;
  if (is("/nutrition")) return <NutritionSkeleton />;
  if (is("/leaderboard")) return <LeaderboardSkeleton />;
  if (is("/coach")) return <CoachSkeleton />;
  if (is("/profile", "/user/")) return <ProfileSkeleton />;
  if (is("/feed", "/squad")) return <FeedSkeleton />;
  if (is("/settings", "/memory", "/notifications", "/blocked", "/admin")) return <SettingsSkeleton />;
  if (is("/paywall")) {
    return (
      <div className="px-4 pt-6 pb-8 animate-fade-in">
        <Block height={64} className="w-16 mx-auto !rounded-2xl" />
        <Block height={440} delay={80} className="mt-6 !rounded-3xl" />
      </div>
    );
  }
  if (is("/messages", "/tribes", "/battles", "/friends", "/recipes", "/exercises", "/vault")) return <ListSkeleton />;
  return <SubPageSkeleton />;
};

export default RouteFallback;
