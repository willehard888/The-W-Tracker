import ConfirmDialog from "@/components/ui/confirm-dialog";
import { fmtDate, fmtInt } from "@/lib/format";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { DetailSkeleton } from "@/components/skeletons/PageSkeleton";
import { useNavigate, useParams } from "react-router-dom";
import { Portal } from "@/components/ui/Portal";
import { supabase } from "@/integrations/supabase/client";
import { uniqueChannelName } from "@/lib/realtime";
import { useAuth } from "@/contexts/AuthContext";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { Button } from "@/components/ui/button";
import PageBar from "@/components/ui/page-bar";
import {
  Zap,
  UserPlus,
  Flame,
  Swords,
  Trophy,
  Landmark,
  UserCheck,
  ShieldAlert,
  Lock,
  Users,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-copy";
import TribeInviteModal from "@/components/TribeInviteModal";
import TribePendingRequestsDialog from "@/components/TribePendingRequestsDialog";
import TribeReportsDialog from "@/components/TribeReportsDialog";
import TribeManageDialog from "@/components/TribeManageDialog";
import TribeEvents from "@/components/tribe/TribeEvents";
import EmptyState from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { DoorRow } from "@/components/coach/rows";
import TribeComposer from "@/components/tribe/TribeComposer";
import TribeHero from "@/components/tribe/TribeHero";
import { downscaleImage } from "@/lib/downscale-image";
import TribePostCard, { type TribePostCardPost } from "@/components/TribePostCard";
import { useModeration } from "@/hooks/use-moderation";
import MemberContributionStrip from "@/components/MemberContributionStrip";
import FeedTheFireCTA from "@/components/FeedTheFireCTA";
import TribeAmbientFireField from "@/components/TribeAmbientFireField";
import { useTribeFireReactor } from "@/hooks/use-tribe-fire-reactor";
import { hapticImpact, hapticSelection, hapticNotification } from "@/lib/haptics";
import { backOr } from "@/lib/nav";
import { collectivePalette, collectiveStreakTier, collectiveTierName, tierName, withAlpha } from "@/lib/tribe-streak";

interface Member {
  user_id: string;
  username: string;
  avatar_url: string | null;
  status_tier: string | null;
  role: string;
  streak?: number;
}

interface Milestone {
  id: string;
  kind: "founded" | "member_joined" | "tier_up" | "battle_won" | "challenge_done";
  payload: Record<string, unknown> | null;
  created_at: string;
}

const milestoneLine = (m: Milestone): { icon: LucideIcon; text: string } => {
  const p = m.payload ?? {};
  switch (m.kind) {
    case "founded":       return { icon: Landmark, text: `${p.name ?? "This tribe"} was founded` };
    case "member_joined": return { icon: UserPlus, text: `@${p.username ?? "?"} joined the tribe` };
    case "tier_up":       return { icon: Flame, text: `Fire tier up — ${tierName(Number(p.tier))} (${p.streak ?? "?"}d)` };
    case "battle_won":    return { icon: Swords, text: `Battle won vs ${p.opponent ?? "?"} (${p.score ?? ""})` };
    case "challenge_done": return { icon: Trophy, text: `Weekly challenge crushed` };
  }
};

const SUPPORTED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const SUPPORTED_VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov"];
const MAX_IMAGE_SIZE_MB = 8;
const MAX_VIDEO_SIZE_MB = 50;
const TRIBES_HOME = "/squad?tab=tribes";

// Stable empties: `?? []` minted a fresh array per render and re-ran every
// effect and memo keyed on posts/members while the query was still loading.
const NO_POSTS: TribePostCardPost[] = [];
const NO_MILESTONES: Milestone[] = [];
const NO_MEMBERS: Member[] = [];

const LABEL = "text-[11px] font-bold text-muted-foreground";

const TribeDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const moderation = useModeration();
  const fileRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  // Feed pagination: the tribe query fetches up to this many posts; "Load
  // older" raises it. Part of the query key, so the cache can't serve a
  // 50-post page for a 100-post request.
  const [postLimit, setPostLimit] = useState(50);
  const [composer, setComposer] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  // Revoke the previous video blob URL whenever the preview changes or the
  // page unmounts — WKWebView otherwise holds every tried clip in memory.
  useEffect(() => {
    const url = videoPreview;
    return () => { if (url?.startsWith("blob:")) URL.revokeObjectURL(url); };
  }, [videoPreview]);

  const [posting, setPosting] = useState(false);
  const [uploadPhase, setUploadPhase] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);

  // Set of post IDs currently rendered in this tribe. Child realtime tables
  // (comments / reactions / kudos) key on post_id, NOT tribe_id, so a
  // Postgres-changes filter can't scope them to this tribe — we guard in JS
  // by checking the payload's post_id against this set before refetching.
  const postIdsRef = useRef<Set<string>>(new Set());

  // Admin check (shared cache across the app)
  const isAdmin = useIsAdmin(user?.id);

  // Kudos given this month — shared budget across feeds (uses tribe_post_kudos)
  const { data: kudosGivenThisMonth, refetch: refetchKudos } = useQuery({
    queryKey: ["tribe-kudos-given-month", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const { count } = await supabase
        .from("tribe_post_kudos")
        .select("id", { count: "exact", head: true })
        .eq("giver_id", user.id)
        .gte("created_at", startOfMonth);
      return count || 0;
    },
    enabled: !!user,
  });

  const kudosRemaining = Math.max(0, 2 - (kudosGivenThisMonth || 0));

  // Today's check-in pulse — one cheap RPC, now for every viewer (aggregate
  // count only; per-member data stays server-side by the privacy decision).
  const { data: todayPulse } = useQuery({
    queryKey: ["tribe-pulse", id],
    enabled: !!id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.rpc("tribe_today_pulse", { p_tribe_ids: [id!] });
      const row = (data ?? [])[0];
      return row ? { checked: row.checked, total: row.total } : null;
    },
  });
  // Founder decision: kudos is open to every member (2/month, enforced by RLS).
  const canKudos = !!profile;

  const queryClient = useQueryClient();
  const userId = profile?.user_id;

  // Main payload — one query. The query cache replaces the old per-tribe
  // snapshot map (re-entry hydrates instantly from cache while a background
  // refetch runs), and keepPreviousData replaces the manual "skeleton only on
  // FIRST load" flag: refreshes (a comment, a kudos, another member's realtime
  // event) update in place — replacing the tree with a skeleton destroyed open
  // comment threads and typed drafts.
  const { data: tribeData, isError, refetch } = useQuery({
    queryKey: ["tribe-detail", id, userId, postLimit],
    enabled: !!id && !!userId,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const [tRes, mRes, pRes, allMRes] = await Promise.all([
        supabase.from("tribes").select("*").eq("id", id!).maybeSingle(),
        supabase.from("tribe_members").select("role, status").eq("tribe_id", id!).eq("user_id", userId!).maybeSingle(),
        supabase.from("tribe_posts").select("*").eq("tribe_id", id!).order("created_at", { ascending: false }).limit(postLimit),
        supabase.from("tribe_members").select("user_id, role").eq("tribe_id", id!).eq("status", "active").limit(40),
      ]);
      // A failed read is not a hidden tribe: surface it as an error, not as
      // "this tribe is private".
      if (tRes.error) throw tRes.error;

      const m = mRes.data;

      const rawMembers = allMRes.data ?? [];
      const memberIds = rawMembers.map((r) => r.user_id);
      // streak included — MemberContributionStrip ranks by it (it silently
      // rendered every member as 0d while this select omitted the column).
      const { data: memberProfiles } = memberIds.length
        ? await supabase.from("profiles").select("user_id, username, avatar_url, status_tier, streak").in("user_id", memberIds)
        : { data: [] };
      const profMap = new Map((memberProfiles ?? []).map((p) => [p.user_id, p]));
      const members = rawMembers.map((r) => {
        const p = profMap.get(r.user_id);
        return p ? { ...p, role: r.role } : null;
      }).filter(Boolean).sort((a: any, b: any) => {
        const order: Record<string, number> = { owner: 0, admin: 1, member: 2 };
        return (order[a.role] ?? 3) - (order[b.role] ?? 3);
      }) as Member[];

      const rawPosts = pRes.data ?? [];
      const postIds = rawPosts.map((p) => p.id);
      const authorIds: string[] = Array.from(new Set(rawPosts.map((p) => p.user_id)));
      const [authorRes, reactionsRes, kudosRes] = await Promise.all([
        authorIds.length
          ? supabase.from("profiles").select("user_id, username, avatar_url, status_tier, level, streak").in("user_id", authorIds)
          : Promise.resolve({ data: [] as any[] } as any),
        postIds.length && userId
          ? supabase.from("tribe_post_reactions").select("post_id").eq("user_id", userId).in("post_id", postIds)
          : Promise.resolve({ data: [] as any[] } as any),
        postIds.length && userId
          ? supabase.from("tribe_post_kudos").select("post_id").eq("giver_id", userId).in("post_id", postIds)
          : Promise.resolve({ data: [] as any[] } as any),
      ]);
      const aMap = new Map(((authorRes as any).data ?? []).map((a: any) => [a.user_id, a]));
      const likedSet = new Set(((reactionsRes as any).data ?? []).map((r: any) => r.post_id));
      const kudosedSet = new Set(((kudosRes as any).data ?? []).map((r: any) => r.post_id));
      const posts = rawPosts.map((p: any) => ({
        ...p,
        author: aMap.get(p.user_id) ?? undefined,
        liked: likedSet.has(p.id),
        kudosed: kudosedSet.has(p.id),
      })) as TribePostCardPost[];

      let pendingCount = 0;
      let reportedCount = 0;
      if (m?.role === "owner") {
        const { count } = await supabase
          .from("tribe_members")
          .select("user_id", { count: "exact", head: true })
          .eq("tribe_id", id!)
          .eq("status", "pending");
        pendingCount = count ?? 0;

        const { count: rCount } = await supabase
          .from("tribe_posts")
          .select("id", { count: "exact", head: true })
          .eq("tribe_id", id!)
          .eq("reported", true);
        reportedCount = rCount ?? 0;
      }

      // Tribe collective streak — sum of every active member's LIVE streak, from
      // the same member profiles the "Who's feeding the fire" strip renders.
      // The server column tribes.collective_streak is only recomputed nightly
      // (refresh_tribe_fire cron), so reading it made the flame lag the strip
      // (strip 3+3=6, flame stuck at last night's 4). Computing it live here
      // keeps the headline number and the member strip in lockstep. The server
      // column still feeds leaderboard/tier/history where a nightly snapshot is
      // acceptable.
      const liveCollective = (memberProfiles ?? []).reduce(
        (sum, p) => sum + (p?.streak ?? 0),
        0,
      );

      // Milestone ledger — tier-ups, joins, battle wins woven into the feed.
      let milestones: Milestone[] = [];
      try {
        const { data: ms } = await supabase
          .from("tribe_milestones")
          .select("id, kind, payload, created_at")
          .eq("tribe_id", id!)
          .order("created_at", { ascending: false })
          .limit(15);
        milestones = (ms ?? []) as unknown as Milestone[];
      } catch {
        milestones = [];
      }

      // Weekly challenge — ensure this week's exists (idempotent), then read it.
      let challenge: { week_start: string; target: number; progress: number; status: string } | null = null;
      try {
        await supabase.rpc("ensure_tribe_challenge", { p_tribe_id: id! });
        const { data: ch } = await supabase
          .from("tribe_challenges")
          .select("week_start, target, progress, status")
          .eq("tribe_id", id!)
          .order("week_start", { ascending: false })
          .limit(1)
          .maybeSingle();
        challenge = ch ?? null;
      } catch {
        challenge = null;
      }

      return {
        tribe: tRes.data,
        posts,
        milestones,
        challenge,
        members,
        isMember: m?.status === "active",
        isOwner: m?.role === "owner",
        pendingCount,
        reportedCount,
        collectiveStreak: liveCollective,
        canLoadMore: rawPosts.length >= postLimit,
      };
    },
  });

  const tribe = tribeData?.tribe ?? null;
  const posts = tribeData?.posts ?? NO_POSTS;
  const milestones = tribeData?.milestones ?? NO_MILESTONES;
  const challenge = tribeData?.challenge ?? null;
  const members = tribeData?.members ?? NO_MEMBERS;
  const isMember = tribeData?.isMember ?? false;
  const isOwner = tribeData?.isOwner ?? false;
  const pendingCount = tribeData?.pendingCount ?? 0;
  const reportedCount = tribeData?.reportedCount ?? 0;
  const canLoadMore = tribeData?.canLoadMore ?? false;

  const invalidateTribe = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["tribe-detail", id] }),
    [queryClient, id],
  );

  // Collective streak lives in local state (seeded from the query) because the
  // fire reactor bumps it optimistically the instant a member checks in; each
  // refetch snaps it back to the server-derived sum, same as load() did.
  const [collectiveStreak, setCollectiveStreak] = useState(
    () => tribeData?.collectiveStreak ?? 0,
  );
  useEffect(() => {
    if (tribeData) setCollectiveStreak(tribeData.collectiveStreak);
  }, [tribeData]);

  // Keep postIdsRef in sync with the rendered posts so realtime child-table
  // events can be scoped to this tribe.
  useEffect(() => {
    postIdsRef.current = new Set(posts.map((p) => p.id));
  }, [posts]);

  // Realtime fire reactor — flame jumps every time a member's streak ticks up
  const memberIds = useMemo(() => members.map((m) => m.user_id), [members]);
  const fireReactor = useTribeFireReactor(memberIds);

  // Optimistically grow the collective streak the instant a member checks in,
  // and fire a soft haptic when it's the current user's own check-in.
  // Also detect tier-up crossings to play a celebration burst.
  const lastEventIdRef = useRef<string | null>(null);
  const lastTierRef = useRef<number>(collectiveStreakTier(collectiveStreak));
  const [tierUp, setTierUp] = useState<{ name: string; accent: string; key: number } | null>(null);
  useEffect(() => {
    const latest = fireReactor.events[fireReactor.events.length - 1];
    if (!latest || latest.id === lastEventIdRef.current) return;
    lastEventIdRef.current = latest.id;
    setCollectiveStreak((prev) => {
      const next = prev + latest.delta;
      const prevTier = collectiveStreakTier(prev);
      const nextTier = collectiveStreakTier(next);
      if (nextTier > prevTier && nextTier >= 0) {
        setTierUp({
          name: collectiveTierName(next),
          accent: collectivePalette(next).glow,
          key: Date.now(),
        });
        // Auto-dismiss tier-up celebration after 4s
        setTimeout(() => setTierUp(null), 4200);
        // Stronger haptic for tier-ups
        hapticImpact("medium");
      }
      lastTierRef.current = nextTier;
      return next;
    });
    if (latest.userId === profile?.user_id) {
      hapticImpact("light");
    }
  }, [fireReactor.events, profile?.user_id]);

  // Realtime: refresh on new posts/comments/kudos/reactions in this tribe.
  //
  // Channel name carries a per-mount UUID so React StrictMode's
  // double-mount (and HMR re-mounts) doesn't return a cached, already-
  // subscribed channel on the second mount — which makes `.on()` throw
  //   "cannot add `postgres_changes` callbacks for ... after `subscribe()`"
  // and crashes the entire TribeDetail render tree. Same fix we shipped
  // for `use-user-habits` + `use-daily-plan` in commit cb1bf49.
  useEffect(() => {
    if (!id) return;

    // Debounce: a burst of events (e.g. a post + its first reaction) should
    // trigger a single refetch, not one per row.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleLoad = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        queryClient.invalidateQueries({ queryKey: ["tribe-detail", id] });
      }, 600);
    };

    // Child tables key on post_id, not tribe_id. Only refetch when the changed
    // row belongs to a post currently shown in THIS tribe — otherwise every
    // comment/reaction/kudos across the whole app would wake this screen.
    const belongsToTribe = (payload: any) => {
      const postId = payload?.new?.post_id ?? payload?.old?.post_id;
      return !!postId && postIdsRef.current.has(postId);
    };

    const channel = supabase
      .channel(uniqueChannelName("tribe-feed", id))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tribe_posts", filter: `tribe_id=eq.${id}` },
        () => scheduleLoad(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tribe_post_comments" },
        (payload) => { if (belongsToTribe(payload)) scheduleLoad(); },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tribe_post_reactions" },
        (payload) => { if (belongsToTribe(payload)) scheduleLoad(); },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tribe_post_kudos" },
        (payload) => { if (belongsToTribe(payload)) scheduleLoad(); },
      )
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [id, queryClient]);

  // Timeline — posts and milestones interleaved by time. Milestones give
  // even a quiet tribe a heartbeat (founded, joins, tier-ups, wins).
  const timeline = useMemo(
    () =>
      [
        ...posts.map((p) => ({ t: Date.parse(p.created_at), post: p, ms: null as Milestone | null })),
        ...milestones.map((m) => ({ t: Date.parse(m.created_at), post: null as TribePostCardPost | null, ms: m })),
      ].sort((a, b) => b.t - a.t),
    [posts, milestones],
  );

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const lowerName = file.name.toLowerCase();
    const isImage = file.type.startsWith("image/") || SUPPORTED_IMAGE_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
    if (!isImage) { toast.error("Please select an image."); e.target.value = ""; return; }
    if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) { toast.error(`Max ${MAX_IMAGE_SIZE_MB}MB.`); e.target.value = ""; return; }
    hapticSelection();
    setVideoFile(null); setVideoPreview(null);
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVideo = file.type.startsWith("video/") || SUPPORTED_VIDEO_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext));
    if (!isVideo) { toast.error("Please select a video."); e.target.value = ""; return; }
    if (file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) { toast.error(`Max ${MAX_VIDEO_SIZE_MB}MB.`); e.target.value = ""; return; }
    hapticSelection();
    setImageFile(null); setImagePreview(null);
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
  };

  const handlePost = async () => {
    const text = composer.trim();
    if (!text && !imageFile && !videoFile) return;
    if (!user || !id) return;
    setPosting(true);
    try {
      let image_url: string | null = null;
      let video_url: string | null = null;

      if (imageFile) {
        const outcome = await moderation.moderateImage({ file: imageFile, kind: "feed_post" });
        if (outcome.blocked) throw new Error(outcome.friendlyMessage ?? "Image rejected by content policy");
      } else if (text) {
        const outcome = await moderation.moderateText({ text, kind: "feed_post" });
        if (outcome.blocked) throw new Error(outcome.friendlyMessage ?? "Post rejected by content policy");
      }

      if (imageFile) {
        // Shrink before upload so we don't store/serve multi-MB originals.
        setUploadPhase("Optimizing…");
        const upload = await downscaleImage(imageFile, { maxDim: 2048, quality: 0.9 });
        const ext = upload.name.split(".").pop()?.toLowerCase() || "jpg";
        const safeExt = ["jpeg", "jpg", "png", "webp", "heic", "heif"].includes(ext) ? ext : "jpg";
        const path = `${user.id}/tribes/${Date.now()}.${safeExt}`;
        const contentType = upload.type || `image/${safeExt === "jpg" ? "jpeg" : safeExt}`;
        setUploadPhase("Uploading…");
        const { error: upErr } = await supabase.storage.from("feed-images").upload(path, upload, {
          cacheControl: "3600", upsert: false, contentType,
        });
        if (upErr) throw new Error(`Image upload failed: ${upErr.message}`);
        image_url = supabase.storage.from("feed-images").getPublicUrl(path).data.publicUrl;
      }

      if (videoFile) {
        setUploadPhase("Uploading…");
        const ext = videoFile.name.split(".").pop()?.toLowerCase() || "mp4";
        const path = `${user.id}/tribes/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("feed-images").upload(path, videoFile, {
          cacheControl: "3600", upsert: false, contentType: videoFile.type || `video/${ext}`,
        });
        if (upErr) throw new Error(`Video upload failed: ${upErr.message}`);
        video_url = supabase.storage.from("feed-images").getPublicUrl(path).data.publicUrl;
      }

      const { error } = await supabase.from("tribe_posts").insert({
        tribe_id: id,
        user_id: user.id,
        content: text || null,
        image_url,
        video_url,
      });
      if (error) throw error;

      setComposer("");
      setImageFile(null); setImagePreview(null);
      setVideoFile(null); setVideoPreview(null);
      hapticNotification("success");
      toast.success("Posted! 🔥");
      invalidateTribe();
    } catch (e: any) {
      toast.error(friendlyError(e, "Could not post. Try again."));
    } finally {
      setPosting(false);
      setUploadPhase(null);
    }
  };

  const handleJoin = async () => {
    const { data, error } = await supabase.rpc("join_tribe", { p_tribe_id: id! });
    if (error) { toast.error(friendlyError(error)); return; }
    if (data === "pending") toast.success("Request sent");
    else toast.success("Joined!");
    invalidateTribe();
  };

  const handleLeave = async () => {
    const { error } = await supabase.rpc("leave_tribe", { p_tribe_id: id! });
    if (error) { toast.error(friendlyError(error)); return; }
    toast.success("Left the tribe");
    invalidateTribe();
  };

  const [confirmDeleteTribe, setConfirmDeleteTribe] = useState(false);
  const handleDelete = () => setConfirmDeleteTribe(true);
  const deleteTribe = async () => {
    const { error } = await supabase.rpc("delete_tribe", { p_tribe_id: id! });
    if (error) { toast.error(friendlyError(error)); return; }
    toast.success("Tribe deleted");
    navigate(TRIBES_HOME);
  };

  // Stable: TribePostCard is memo'd on it; a fresh closure per render made
  // every card re-render on every scroll tick.
  const handleChanged = useCallback(() => {
    refetchKudos();
    invalidateTribe();
  }, [refetchKudos, invalidateTribe]);

  // Share the tribe out of the app — native share sheet where available,
  // clipboard everywhere else. The link is the web origin so recipients
  // without the app still land somewhere real.
  const handleShare = async () => {
    const url = `https://whealthfactory.com/tribes/${id}`;
    const text = collectiveStreak > 0
      ? `Join ${tribe?.name ?? "my tribe"} on Whealth Factory — ${collectiveStreak} days of collective fire 🔥`
      : `Join ${tribe?.name ?? "my tribe"} on Whealth Factory`;
    try {
      if (navigator.share) {
        await navigator.share({ title: tribe?.name ?? "Tribe", text, url });
        return;
      }
    } catch {
      // user dismissed the sheet — fall through to nothing
      return;
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      toast.success("Link copied — send it to your crew");
    } catch {
      toast.error("Couldn't copy the link");
    }
  };

  const goBack = () => { hapticSelection(); backOr(navigate, TRIBES_HOME); };

  if (!tribeData) {
    if (isError) {
      return (
        <div className="min-h-full">
          <PageBar onBack={goBack} />
          <div className="home-rise px-4 pt-4 pb-6">
            <ErrorState title="Couldn't load this tribe" onRetry={refetch} />
          </div>
        </div>
      );
    }
    return <DetailSkeleton />;
  }

  if (!tribe) {
    // RLS hides private tribes from non-members entirely — so a shared link
    // to one lands here, and so does a deleted tribe. Offer the request path
    // (join_tribe is SECURITY DEFINER; it works even when the row is hidden)
    // and a door back to the browse list.
    return (
      <div className="min-h-full">
        <PageBar onBack={goBack} />
        <div className="home-rise px-4 pt-4 pb-6">
          <EmptyState
            icon={Lock}
            title="This tribe is private"
            description="Its fire, feed and events open up once you're in. If the link is old, the tribe may be gone."
            action={
              <Button variant="ember" className="min-h-11" onClick={handleJoin}>
                Request to join
              </Button>
            }
          />
          <div className="mt-4 border-t border-border/35">
            <DoorRow icon={Users} label="Browse tribes" sub="Find one with its fire already lit" onClick={() => navigate(TRIBES_HOME)} />
          </div>
        </div>
      </div>
    );
  }

  // DEV-only tier preview: /tribes/:id?fireTotal=1600 forces the hero tier so
  // every flame tier is verifiable without a 1600-day tribe. Dead code in prod.
  const devFireTotal = import.meta.env.DEV
    ? Number(new URLSearchParams(window.location.search).get("fireTotal")) || 0
    : 0;
  const fireTotal = devFireTotal > 0 ? devFireTotal : collectiveStreak;

  // Tier-reactive page tint based on tribe's collective heat
  const pageTint = fireTotal >= 30
    ? collectivePalette(fireTotal).glow
    : null;

  const showToday = !!challenge || isMember || (!!todayPulse && todayPulse.total > 0);

  return (
    <div className="min-h-full relative">
      <PageBar onBack={goBack} />
      <div className="px-4 pt-4 pb-6">
      {/* Subtle page tint toward the tribe's tier color */}
      {pageTint && (
        <div
          aria-hidden
          className="absolute top-0 left-0 right-0 h-[420px] pointer-events-none -z-10 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,var(--tint)_0%,transparent_75%)]"
          style={{ "--tint": withAlpha(pageTint, 0.12) } as CSSProperties}
        />
      )}

      {/* Ambient fire field — drifting embers across the whole tribe page,
          intensifies with collective heat. Fixed behind content. */}
      {pageTint && (
        <div className="fixed inset-0 pointer-events-none -z-10">
          <TribeAmbientFireField total={fireTotal} accent={pageTint} />
        </div>
      )}

      {/* Tier-up celebration — full-screen flash when crossing a threshold */}
      {tierUp && (
        <Portal>
        <div
          key={tierUp.key}
          aria-hidden
          className="fixed inset-0 z-[var(--z-celebration)] pointer-events-none flex items-center justify-center animate-fade-in"
          style={{
            "--acc": tierUp.accent,
            "--acc-a": withAlpha(tierUp.accent, 0.18),
            "--acc-b": withAlpha(tierUp.accent, 0.3),
            "--acc-d": withAlpha(tierUp.accent, 0.7),
          } as CSSProperties}
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--acc-b)_0%,transparent_60%)] animate-[fire-flash-bloom_1200ms_cubic-bezier(.2,.8,.2,1)_forwards]" />
          <div className="relative px-8 py-5 rounded-2xl border-2 border-[var(--acc)] bg-[linear-gradient(135deg,var(--acc-a),hsl(var(--background)/0.92))] shadow-[0_0_60px_var(--acc-d),inset_0_1px_0_hsl(0_0%_100%/0.15)] animate-[ember-rise-chip_4000ms_cubic-bezier(.2,.8,.2,1)_forwards]">
            <p className="text-[11px] font-bold text-center mb-1 text-[var(--acc)]">Tribe Fire promoted</p>
            <p className="font-display font-black text-3xl text-center uppercase text-[var(--acc)] [text-shadow:0_0_28px_var(--acc-d)]">
              {tierUp.name}
            </p>
          </div>
        </div>
        </Portal>
      )}

      {/* HERO — the tribe's one cinematic card: fire, identity, actions */}
      <div className="home-rise">
        <TribeHero
          tribe={tribe}
          total={fireTotal}
          members={members}
          isMember={isMember}
          isOwner={isOwner}
          reactor={fireReactor}
          todayPulse={todayPulse ?? null}
          onNavigateUser={(uid) => navigate(`/user/${uid}`)}
          onNavigateBattles={() => navigate(`/tribes/${id}/battles`)}
          onJoin={handleJoin}
          onManage={() => setManageOpen(true)}
          onInvite={() => setInviteOpen(true)}
          onDelete={handleDelete}
          onLeave={handleLeave}
          onShare={handleShare}
        />
      </div>

      {/* Owner doors — only when something needs the owner */}
      {isOwner && (pendingCount > 0 || reportedCount > 0) && (
        <div className="home-rise home-rise-1 mt-4">
          <div className="surface-card surface-card-quiet px-3 divide-y divide-border/35">
            {pendingCount > 0 && (
              <DoorRow
                icon={UserCheck}
                label={`${pendingCount} ${pendingCount === 1 ? "person wants" : "people want"} to join`}
                sub="Pending requests"
                onClick={() => setPendingOpen(true)}
              />
            )}
            {reportedCount > 0 && (
              <DoorRow
                icon={ShieldAlert}
                label={`${reportedCount} ${reportedCount === 1 ? "post needs" : "posts need"} your review`}
                sub="Reported posts"
                onClick={() => setReportsOpen(true)}
              />
            )}
          </div>
        </div>
      )}

      {/* TODAY — check in, and the week's shared goal */}
      {showToday && (
        <div className="home-rise home-rise-2 mt-5">
          <div className="flex items-baseline justify-between mb-2 px-1">
            <span className={LABEL}>Today</span>
            <span className="flex items-center gap-3">
              {todayPulse && todayPulse.total > 0 && (
                <span className="text-[12px] font-bold tabular-nums text-[hsl(var(--ember))]">
                  {todayPulse.checked}/{todayPulse.total} lit today
                </span>
              )}
              {isOwner && (tribe.weekly_xp ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1 text-[12px] font-bold tabular-nums text-gold">
                  <Zap size={12} fill="currentColor" aria-hidden /> +{fmtInt(tribe.weekly_xp ?? 0)} XP
                </span>
              )}
            </span>
          </div>

          {isMember && (
            <FeedTheFireCTA
              accent={fireTotal >= 30 ? collectivePalette(fireTotal).glow : undefined}
              tribeName={tribe?.name}
              className="mb-3"
            />
          )}

          {challenge && (() => {
            const done = challenge.status === "completed";
            const failed = challenge.status === "failed";
            const pct = Math.min(100, Math.round((challenge.progress / Math.max(1, challenge.target)) * 100));
            const end = new Date(challenge.week_start); end.setDate(end.getDate() + 7);
            const daysLeft = Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86400000));
            return (
              <div className={cn("surface-card surface-card-quiet p-3.5", done && "border-gold/40")}>
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-[13px] font-bold tabular-nums">
                    {challenge.progress}/{challenge.target} check-ins together
                  </span>
                  <span className="text-[12px] tabular-nums text-muted-foreground">
                    {done ? "Crushed · +25 XP each" : failed ? "last week missed" : `${daysLeft}d left · ${pct}%`}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-700",
                      failed ? "bg-muted-foreground/40" : done ? "bg-gold" : "bg-[hsl(var(--ember))]",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Who's feeding the fire — sorted by personal streak */}
      {members.length > 0 && (
        <div className="home-rise home-rise-3 mt-5">
          <MemberContributionStrip
            members={members.map((m) => ({
              user_id: m.user_id,
              username: m.username,
              avatar_url: m.avatar_url,
              streak: m.streak ?? 0,
              role: m.role,
            }))}
          />
        </div>
      )}

      {/* Meetups & events — the show-up-together loop */}
      {id && (
        <div className="home-rise home-rise-4 mt-5">
          <TribeEvents tribeId={id} isMember={isMember} currentUserId={profile?.user_id} />
        </div>
      )}

      {/* Composer with media */}
      {isMember && (
        <div className="home-rise home-rise-5 mt-6">
          <TribeComposer
            value={composer}
            onChange={setComposer}
            imagePreview={imagePreview}
            videoPreview={videoPreview}
            onClearImage={() => { setImageFile(null); setImagePreview(null); }}
            onClearVideo={() => { setVideoFile(null); setVideoPreview(null); }}
            fileRef={fileRef}
            videoInputRef={videoInputRef}
            onImageSelect={handleImageSelect}
            onVideoSelect={handleVideoSelect}
            posting={posting}
            hasImage={!!imageFile}
            hasVideo={!!videoFile}
            onPost={handlePost}
            progressLabel={uploadPhase}
          />
        </div>
      )}

      {/* Timeline — post cards, with milestones as hairline lines between them.
          Below the fold, so no entrance: animating a 50-post list buys nothing. */}
      <div className={cn("space-y-3", !isMember && "mt-6")}>
        {timeline.length === 0 ? (
          <EmptyState
            icon={Flame}
            title="Be the first to ignite this tribe"
            description="Share something the tribe needs to hear."
          />
        ) : (
          timeline.map((item) => {
            if (item.post) {
              return (
                <TribePostCard
                  key={item.post.id}
                  post={item.post}
                  isMember={isMember}
                  isOwner={isOwner}
                  isAdmin={!!isAdmin}
                  canKudos={canKudos}
                  kudosRemaining={kudosRemaining}
                  onChanged={handleChanged}
                />
              );
            }
            const ms = item.ms!;
            const { icon: Icon, text } = milestoneLine(ms);
            return (
              <div key={ms.id} className="flex items-center gap-2.5 px-1 py-1.5">
                <Icon size={14} className="text-muted-foreground shrink-0" aria-hidden />
                <p className="text-[12px] font-semibold text-foreground/80 flex-1 min-w-0 truncate">{text}</p>
                <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">{fmtDate(ms.created_at)}</span>
              </div>
            );
          })
        )}
        {canLoadMore && (
          <Button
            variant="secondary"
            size="sm"
            className="w-full min-h-11"
            onClick={() => setPostLimit((n) => n + 50)}
          >
            Load older posts
          </Button>
        )}
      </div>

      {/* Non-member preview → sticky conversion bar. The public tribe's
          content above is the pitch; this is the one action. */}
      {!isMember && (
        <Portal>
          <div className="fixed left-0 right-0 bottom-[calc(env(safe-area-inset-bottom)+72px)] z-[var(--z-top)] px-4 pointer-events-none">
            <div className="max-w-md mx-auto pointer-events-auto rounded-2xl border border-[hsl(var(--ember))]/45 bg-[hsl(var(--background)/0.96)] shadow-[var(--shadow-3)] p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-black truncate">{tribe.name}</p>
                <p className="text-[11px] text-muted-foreground truncate tabular-nums">
                  {tribe.member_count} member{tribe.member_count === 1 ? "" : "s"}
                  {collectiveStreak > 0 ? ` · ${collectiveStreak}d collective fire` : ""}
                </p>
              </div>
              <Button size="sm" variant="ember" onClick={handleJoin} className="shrink-0 min-h-11">
                {tribe.visibility === "private" ? "Request to join" : "Join tribe"}
              </Button>
            </div>
          </div>
        </Portal>
      )}

      {id && (
        <>
          <TribeInviteModal tribeId={id} open={inviteOpen} onClose={() => setInviteOpen(false)} />
          <TribePendingRequestsDialog tribeId={id} open={pendingOpen} onOpenChange={setPendingOpen} onChanged={invalidateTribe} />
          <TribeReportsDialog tribeId={id} open={reportsOpen} onOpenChange={setReportsOpen} onChanged={invalidateTribe} />
          <ConfirmDialog
            open={confirmDeleteTribe}
            onOpenChange={setConfirmDeleteTribe}
            title="Delete this tribe?"
            description="This cannot be undone."
            onConfirm={() => { setConfirmDeleteTribe(false); void deleteTribe(); }}
          />
          {isOwner && tribe && profile?.user_id && (
            <TribeManageDialog
              tribeId={id}
              open={manageOpen}
              onOpenChange={setManageOpen}
              tribe={{
                name: tribe.name,
                description: tribe.description,
                visibility: tribe.visibility,
                cover_url: tribe.cover_url,
                primary_activity: tribe.primary_activity ?? null,
              }}
              members={members}
              currentUserId={profile.user_id}
              onChanged={invalidateTribe}
            />
          )}
        </>
      )}
      </div>
    </div>
  );
};

export default TribeDetail;
