import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import RouteFallback from "@/components/RouteFallback";
import Index from "@/pages/Index";

/**
 * Persistent tab stack.
 *
 * All eight bottom-nav tabs are mounted into the DOM once the user first
 * visits each one. Tab switches do not unmount — only the active tab is
 * `display:block`, the rest are `display:none`. This preserves:
 *
 *   • scroll position (DOM-native, no JS restoration needed)
 *   • component state (forms, hover, selected items)
 *   • react-query subscriptions and realtime channels
 *   • IntersectionObservers / video players / framer-motion layouts
 *
 * The first paint of any tab still uses Suspense + RouteFallback, but
 * subsequent visits are instant because the chunk is already loaded *and*
 * the React tree is already mounted.
 *
 * Detail / modal routes (`/tribes/:id`, `/chat/:id`, `/paywall`, …) are
 * handled separately in `<ModalStack>` and float above whichever tab was
 * last active — exactly like a native iOS push.
 */

const DailyCheckin = lazy(() => import("@/pages/DailyCheckin"));
const EliteFeed = lazy(() => import("@/pages/EliteFeed"));
const Tribes = lazy(() => import("@/pages/Tribes"));
const Messages = lazy(() => import("@/pages/Messages"));
const Leaderboard = lazy(() => import("@/pages/Leaderboard"));
const Battles = lazy(() => import("@/pages/Battles"));
const Profile = lazy(() => import("@/pages/Profile"));

type TabKey =
  | "/"
  | "/checkin"
  | "/feed"
  | "/tribes"
  | "/messages"
  | "/leaderboard"
  | "/battles"
  | "/profile";

const TAB_KEYS: TabKey[] = [
  "/",
  "/checkin",
  "/feed",
  "/tribes",
  "/messages",
  "/leaderboard",
  "/battles",
  "/profile",
];

const TAB_PREFIXES: Array<{ key: TabKey; match: (p: string) => boolean }> = [
  { key: "/", match: (p) => p === "/" },
  { key: "/checkin", match: (p) => p.startsWith("/checkin") },
  { key: "/feed", match: (p) => p.startsWith("/feed") },
  // Tribes tab also "owns" detail/battles/leaderboard subpages — but those
  // render in ModalStack on top; the tab underneath remains /tribes.
  { key: "/tribes", match: (p) => p === "/tribes" || p === "/tribes/leaderboard" },
  { key: "/messages", match: (p) => p === "/messages" },
  { key: "/leaderboard", match: (p) => p === "/leaderboard" },
  { key: "/battles", match: (p) => p === "/battles" },
  { key: "/profile", match: (p) => p === "/profile" },
];

const isTabPath = (path: string) =>
  TAB_PREFIXES.some(({ match }) => match(path));

export const matchTabKey = (path: string): TabKey | null => {
  const found = TAB_PREFIXES.find(({ match }) => match(path));
  return found ? found.key : null;
};

const TabPane = ({
  active,
  mounted,
  children,
}: {
  active: boolean;
  mounted: boolean;
  children: React.ReactNode;
}) => {
  if (!mounted) return null;
  return (
    <div
      data-tab-active={active ? "true" : "false"}
      // `hidden` removes from a11y tree AND drops layout/paint cost; we still
      // pay the React render cost (which is what we want for instant return).
      hidden={!active}
      // Each tab owns its own scroll — DOM remembers scrollTop natively when
      // the tab returns to view. `contain: layout paint` isolates each tab's
      // layout/paint from siblings, so off-screen tabs cost ~nothing.
      className="absolute inset-0 overflow-y-auto overflow-x-hidden"
      style={{
        contain: "layout paint",
        WebkitOverflowScrolling: "touch",
        overscrollBehavior: "contain",
      }}
    >
      {children}
    </div>
  );
};

const TabHost = () => {
  const location = useLocation();
  const activeTab = useMemo(() => matchTabKey(location.pathname), [location.pathname]);

  // Track which tabs have ever been visited so we lazy-mount on first visit
  // (avoids paying the full mount cost on cold start for tabs the user may
  // never touch). Once mounted, a tab stays mounted for the session.
  const mountedRef = useRef<Set<TabKey>>(new Set(["/"]));
  const [, force] = useState(0);

  useEffect(() => {
    if (activeTab && !mountedRef.current.has(activeTab)) {
      mountedRef.current.add(activeTab);
      force((n) => n + 1);
    }
  }, [activeTab]);

  // If we're on a non-tab route (e.g. /tribes/:id), keep the *last* tab
  // visible underneath so the modal pushed on top has a stable backdrop.
  const lastTabRef = useRef<TabKey>("/");
  useEffect(() => {
    if (activeTab) lastTabRef.current = activeTab;
  }, [activeTab]);

  const visibleTab: TabKey = activeTab ?? lastTabRef.current;
  const showTabs = isTabPath(location.pathname) || !activeTab;

  return (
    <div
      className="absolute inset-0"
      // Tabs themselves never move — only modal stack on top translates.
      // Hiding via opacity (not display) prevents any reflow/repaint flash
      // when a modal opens above; tabs are always laid out underneath.
      style={{
        visibility: showTabs ? "visible" : "visible",
      }}
    >
      <Suspense fallback={<RouteFallback />}>
        <TabPane active={visibleTab === "/"} mounted={mountedRef.current.has("/")}>
          <Index />
        </TabPane>
        <TabPane
          active={visibleTab === "/checkin"}
          mounted={mountedRef.current.has("/checkin")}
        >
          <DailyCheckin />
        </TabPane>
        <TabPane
          active={visibleTab === "/feed"}
          mounted={mountedRef.current.has("/feed")}
        >
          <EliteFeed />
        </TabPane>
        <TabPane
          active={visibleTab === "/tribes"}
          mounted={mountedRef.current.has("/tribes")}
        >
          <Tribes />
        </TabPane>
        <TabPane
          active={visibleTab === "/messages"}
          mounted={mountedRef.current.has("/messages")}
        >
          <Messages />
        </TabPane>
        <TabPane
          active={visibleTab === "/leaderboard"}
          mounted={mountedRef.current.has("/leaderboard")}
        >
          <Leaderboard />
        </TabPane>
        <TabPane
          active={visibleTab === "/battles"}
          mounted={mountedRef.current.has("/battles")}
        >
          <Battles />
        </TabPane>
        <TabPane
          active={visibleTab === "/profile"}
          mounted={mountedRef.current.has("/profile")}
        >
          <Profile />
        </TabPane>
      </Suspense>
    </div>
  );
};

export default TabHost;
