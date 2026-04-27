import { useLocation } from "react-router-dom";
import {
  HomeSkeleton,
  LeaderboardSkeleton,
  ProfileSkeleton,
  FeedSkeleton,
  CheckinSkeleton,
  ListSkeleton,
} from "@/components/skeletons/PageSkeleton";

/**
 * Route-aware fallback. Renders a skeleton that mirrors the destination
 * screen's layout so the route swap is visually continuous (no generic
 * loading flash).
 *
 * Falls back to `ListSkeleton` for unknown routes — never a blank screen.
 */
const RouteFallback = () => {
  const { pathname } = useLocation();

  if (pathname === "/") return <HomeSkeleton />;
  if (pathname.startsWith("/checkin")) return <CheckinSkeleton />;
  if (pathname.startsWith("/leaderboard")) return <LeaderboardSkeleton />;
  if (pathname.startsWith("/profile") || pathname.startsWith("/user/"))
    return <ProfileSkeleton />;
  if (pathname.startsWith("/feed")) return <FeedSkeleton />;
  if (
    pathname.startsWith("/messages") ||
    pathname.startsWith("/tribes") ||
    pathname.startsWith("/battles")
  )
    return <ListSkeleton />;

  return <ListSkeleton />;
};

export default RouteFallback;
