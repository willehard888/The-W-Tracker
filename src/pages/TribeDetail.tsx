import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { DetailSkeleton } from "@/components/skeletons/PageSkeleton";
import { useNavigate, useParams } from "react-router-dom";
import { Portal } from "@/components/ui/Portal";
import { supabase } from "@/integrations/supabase/client";
import { uniqueChannelName } from "@/lib/realtime";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Crown,
  Loader2,
  Send,
  Trash2,
  Users,
  LogOut,
  Zap,
  UserPlus,
  Flame,
  Swords,
  UserCheck,
  Image as ImageIcon,
  Video as VideoIcon,
  X,
  ShieldAlert,
  Settings,
  Shield,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-copy";
import TribeInviteModal from "@/components/TribeInviteModal";
import TribePendingRequestsDialog from "@/components/TribePendingRequestsDialog";
import TribeReportsDialog from "@/components/TribeReportsDialog";
import TribeManageDialog from "@/components/TribeManageDialog";
import TribeEvents from "@/components/tribe/TribeEvents";
import EmptyState from "@/components/ui/empty-state";
import TribeComposer from "@/components/tribe/TribeComposer";
import TribeHero from "@/components/tribe/TribeHero";
import { downscaleImage } from "@/lib/downscale-image";
import TribePostCard, { type TribePostCardPost } from "@/components/TribePostCard";
import { useModeration } from "@/hooks/use-moderation";
import TierUsername from "@/components/TierUsername";
import MemberContributionStrip from "@/components/MemberContributionStrip";
import FeedTheFireCTA from "@/components/FeedTheFireCTA";
import TribeAmbientFireField from "@/components/TribeAmbientFireField";
import { useTribeFireReactor } from "@/hooks/use-tribe-fire-reactor";
import { hapticImpact, hapticSelection, hapticNotification } from "@/lib/haptics";
import { collectivePalette, collectiveAccent, collectiveStreakTier, collectiveTierName, tierName } from "@/lib/tribe-streak";

interface Member {
  user_id: string;
  username: string;
  avatar_url: string | null;
  status_tier: string | null;
  role: string;
}

interface Milestone {
  id: string;
  kind: "founded" | "member_joined" | "tier_up" | "battle_won" | "challenge_done";
  payload: Record<string, unknown> | null;
  created_at: string;
}

const milestoneLine = (m: Milestone): { emoji: string; text: string } => {
  const p = m.payload ?? {};
  switch (m.kind) {
    case "founded":       return { emoji: "🏛️", text: `${p.name ?? "This tribe"} was founded` };
    case "member_joined": return { emoji: "🤝", text: `@${p.username ?? "?"} joined the tribe` };
    case "tier_up":       return { emoji: "🔥", text: `Fire tier up — ${tierName(Number(p.tier))} (${p.streak ?? "?"}d)` };
    case "battle_won":    return { emoji: "⚔️", text: `Battle won vs ${p.opponent ?? "?"} (${p.score ?? ""})` };
    case "challenge_done": return { emoji: "🏆", text: `Weekly challenge crushed` };
  }
};

const SUPPORTED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const SUPPORTED_VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov"];
const MAX_IMAGE_SIZE_MB = 8;
const MAX_VIDEO_SIZE_MB = 50;

const TribeDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const moderation = useModeration();
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [parallax, setParallax] = useState(0);
  const [tribe, setTribe] = useState<any>(null);
  const [posts, setPosts] = useState<TribePostCardPost[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [challenge, setChallenge] = useState<{
    week_start: string; target: number; progress: number; status: string;
  } | null>(null);
  // Feed pagination: load() always fetches up to this many posts; "Load more"
  // raises it and reloads (a ref so the realtime-refetch closure sees it too).
  const postLimitRef = useRef(50);
  const [canLoadMore, setCanLoadMore] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [composer, setComposer] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [uploadPhase, setUploadPhase] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [reportedCount, setReportedCount] = useState(0);
  const [manageOpen, setManageOpen] = useState(false);
  const [collectiveStreak, setCollectiveStreak] = useState(0);

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
      const { data } = await supabase.rpc("tribe_today_pulse" as any, { p_tribe_ids: [id] });
      const row = ((data as any) ?? [])[0];
      return row ? { checked: row.checked as number, total: row.total as number } : null;
    },
  });
  // Founder decision: kudos is open to every member (2/month, enforced by RLS).
  const canKudos = !!profile;

  const load = async () => {
    if (!id || !profile?.user_id) return;
    // Skeleton only on FIRST load. Refreshes (a comment, a kudos, another
    // member's realtime event) update in place — replacing the tree with a
    // skeleton destroyed open comment threads and typed drafts.
    if (!tribe) setLoading(true);

    const [tRes, mRes, pRes, allMRes] = await Promise.all([
      supabase.from("tribes").select("*").eq("id", id).maybeSingle(),
      supabase.from("tribe_members").select("role, status").eq("tribe_id", id).eq("user_id", profile.user_id).maybeSingle(),
      supabase.from("tribe_posts").select("*").eq("tribe_id", id).order("created_at", { ascending: false }).limit(postLimitRef.current),
      supabase.from("tribe_members").select("user_id, role").eq("tribe_id", id).eq("status", "active").limit(40),
    ]);

    setTribe((tRes as any).data);
    const m = (mRes as any).data;
    const member = m?.status === "active";
    setIsMember(member);
    setIsOwner(m?.role === "owner");

    const rawMembers = ((allMRes as any).data) ?? [];
    const memberIds = rawMembers.map((r: any) => r.user_id);
    // streak included — MemberContributionStrip ranks by it (it silently
    // rendered every member as 0d while this select omitted the column).
    const { data: memberProfiles } = memberIds.length
      ? await supabase.from("profiles").select("user_id, username, avatar_url, status_tier, streak").in("user_id", memberIds)
      : { data: [] as any[] };
    const profMap = new Map(((memberProfiles as any) ?? []).map((p: any) => [p.user_id, p]));
    setMembers(
      rawMembers.map((r: any) => {
        const p = profMap.get(r.user_id);
        return p ? { ...(p as any), role: r.role } : null;
      }).filter(Boolean).sort((a: any, b: any) => {
        const order: Record<string, number> = { owner: 0, admin: 1, member: 2 };
        return (order[a.role] ?? 3) - (order[b.role] ?? 3);
      }) as Member[],
    );

    const rawPosts = ((pRes as any).data) ?? [];
    const postIds = rawPosts.map((p: any) => p.id);
    const authorIds: string[] = Array.from(new Set(rawPosts.map((p: any) => p.user_id as string)));
    const [authorRes, reactionsRes, kudosRes] = await Promise.all([
      authorIds.length
        ? supabase.from("profiles").select("user_id, username, avatar_url, status_tier, level, streak").in("user_id", authorIds)
        : Promise.resolve({ data: [] as any[] } as any),
      postIds.length && profile?.user_id
        ? supabase.from("tribe_post_reactions").select("post_id").eq("user_id", profile.user_id).in("post_id", postIds)
        : Promise.resolve({ data: [] as any[] } as any),
      postIds.length && profile?.user_id
        ? supabase.from("tribe_post_kudos").select("post_id").eq("giver_id", profile.user_id).in("post_id", postIds)
        : Promise.resolve({ data: [] as any[] } as any),
    ]);
    const aMap = new Map(((authorRes as any).data ?? []).map((a: any) => [a.user_id, a]));
    const likedSet = new Set(((reactionsRes as any).data ?? []).map((r: any) => r.post_id));
    const kudosedSet = new Set(((kudosRes as any).data ?? []).map((r: any) => r.post_id));
    setPosts(
      rawPosts.map((p: any) => ({
        ...p,
        author: aMap.get(p.user_id) ?? undefined,
        liked: likedSet.has(p.id),
        kudosed: kudosedSet.has(p.id),
      })) as TribePostCardPost[],
    );
    setCanLoadMore(rawPosts.length >= postLimitRef.current);

    if (m?.role === "owner") {
      const { count } = await supabase
        .from("tribe_members")
        .select("user_id", { count: "exact", head: true })
        .eq("tribe_id", id)
        .eq("status", "pending");
      setPendingCount(count ?? 0);

      const { count: rCount } = await supabase
        .from("tribe_posts")
        .select("id", { count: "exact", head: true })
        .eq("tribe_id", id)
        .eq("reported", true);
      setReportedCount(rCount ?? 0);
    } else {
      setPendingCount(0);
      setReportedCount(0);
    }

    // Tribe collective streak — sum of every active member's LIVE streak, from
    // the same member profiles the "Who's feeding the fire" strip renders.
    // The server column tribes.collective_streak is only recomputed nightly
    // (refresh_tribe_fire cron), so reading it made the flame lag the strip
    // (strip 3+3=6, flame stuck at last night's 4). Computing it live here
    // keeps the headline number and the member strip in lockstep. The server
    // column still feeds leaderboard/tier/history where a nightly snapshot is
    // acceptable.
    const liveCollective = ((memberProfiles as any) ?? []).reduce(
      (sum: number, p: any) => sum + (p?.streak ?? 0),
      0,
    );
    setCollectiveStreak(liveCollective);

    // Milestone ledger — tier-ups, joins, battle wins woven into the feed.
    try {
      const { data: ms } = await supabase
        .from("tribe_milestones" as any)
        .select("id, kind, payload, created_at")
        .eq("tribe_id", id)
        .order("created_at", { ascending: false })
        .limit(15);
      setMilestones(((ms as any) ?? []) as Milestone[]);
    } catch {
      setMilestones([]);
    }

    // Weekly challenge — ensure this week's exists (idempotent), then read it.
    try {
      await supabase.rpc("ensure_tribe_challenge" as never, { p_tribe_id: id } as never);
      const { data: ch } = await supabase
        .from("tribe_challenges" as any)
        .select("week_start, target, progress, status")
        .eq("tribe_id", id)
        .order("week_start", { ascending: false })
        .limit(1)
        .maybeSingle();
      setChallenge((ch as any) ?? null);
    } catch {
      setChallenge(null);
    }

    setLoading(false);
  };

  // Keep a live ref to the latest `load` so the realtime effect (which only
  // depends on `id`) always calls the current closure without resubscribing.
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, profile?.user_id]);

  // Keep postIdsRef in sync with the rendered posts so realtime child-table
  // events can be scoped to this tribe.
  useEffect(() => {
    postIdsRef.current = new Set(posts.map((p) => p.id));
  }, [posts]);

  // Realtime fire reactor — flame jumps every time a member's streak ticks up
  const memberIds = members.map((m) => m.user_id);
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
        loadRef.current();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Parallax follows the *parent* scroller (App.tsx provides the single
  // overflow-y container). Listening on window or the nearest scrollable
  // ancestor — we walk up from our wrapper to find it.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let parent: HTMLElement | null = el.parentElement;
    while (parent) {
      const oy = getComputedStyle(parent).overflowY;
      if (oy === "auto" || oy === "scroll") break;
      parent = parent.parentElement;
    }
    const target: HTMLElement | Window = parent ?? window;
    const onScroll = () => {
      const top = parent ? parent.scrollTop : window.scrollY;
      setParallax(Math.min(top * 0.3, 80));
    };
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => target.removeEventListener("scroll", onScroll);
  }, []);

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
      load();
    } catch (e: any) {
      toast.error(friendlyError(e, "Could not post. Try again."));
    } finally {
      setPosting(false);
      setUploadPhase(null);
    }
  };

  const handleJoin = async () => {
    const { data, error } = await supabase.rpc("join_tribe" as any, { p_tribe_id: id });
    if (error) { toast.error(friendlyError(error)); return; }
    if (data === "pending") toast.success("Request sent");
    else toast.success("Joined!");
    load();
  };

  const handleLeave = async () => {
    const { error } = await supabase.rpc("leave_tribe" as any, { p_tribe_id: id });
    if (error) { toast.error(friendlyError(error)); return; }
    toast.success("Left the tribe");
    load();
  };

  const handleDelete = async () => {
    if (!confirm("Delete this tribe? This cannot be undone.")) return;
    const { error } = await supabase.rpc("delete_tribe" as any, { p_tribe_id: id });
    if (error) { toast.error(friendlyError(error)); return; }
    toast.success("Tribe deleted");
    navigate("/squad?tab=tribes");
  };

  const handleChanged = () => {
    refetchKudos();
    load();
  };

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

  if (loading) {
    return (
      <DetailSkeleton />
    );
  }

  if (!tribe) {
    // RLS hides private tribes from non-members entirely — so a shared link
    // to one lands here. Offer the request path instead of a dead end
    // (join_tribe is SECURITY DEFINER; it works even when the row is hidden).
    return (
      <div className="px-4 pt-4 pb-8">
        <button onClick={() => navigate("/squad?tab=tribes")} className="flex items-center gap-1 text-xs text-muted-foreground mb-8 active:scale-95 transition-transform">
          <ArrowLeft size={14} /> Tribes
        </button>
        <div className="surface-card p-6 text-center">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-secondary/50 border border-border/60 flex items-center justify-center mb-3">
            <Lock size={20} className="text-muted-foreground" />
          </div>
          <p className="font-bold text-[15px]">This tribe is private</p>
          <p className="text-[12px] text-muted-foreground mt-1 leading-snug">
            Its fire, feed and events open up once you're in.
          </p>
          <Button variant="ember" size="sm" className="mt-4" onClick={handleJoin}>
            Request to join
          </Button>
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

  return (
    <div ref={scrollRef} className="pb-8 px-4 pt-4 relative">
      {/* Subtle page tint toward the tribe's tier color */}
      {pageTint && (
        <div
          aria-hidden
          className="absolute top-0 left-0 right-0 h-[420px] pointer-events-none -z-10"
          style={{
            background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${pageTint.replace(")", " / 0.12)")} 0%, transparent 75%)`,
          }}
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
          className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center"
          style={{ animation: "fade-in 240ms ease-out forwards" }}
        >
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at center, ${tierUp.accent.replace(")", " / 0.30)")} 0%, transparent 60%)`,
              animation: "fire-flash-bloom 1200ms cubic-bezier(.2,.8,.2,1) forwards",
            }}
          />
          <div
            className="relative px-8 py-5 rounded-2xl border-2 backdrop-blur-md"
            style={{
              borderColor: tierUp.accent,
              background: `linear-gradient(135deg, ${tierUp.accent.replace(")", " / 0.18)")}, hsl(var(--background) / 0.6))`,
              boxShadow: `0 0 60px ${tierUp.accent.replace(")", " / 0.7)")}, inset 0 1px 0 hsl(0 0% 100% / 0.15)`,
              animation: "ember-rise-chip 4000ms cubic-bezier(.2,.8,.2,1) forwards",
            }}
          >
            <p
              className="text-[10px] uppercase tracking-[0.22em] font-black text-center mb-1"
              style={{ color: tierUp.accent }}
            >
              Tribe Fire promoted
            </p>
            <p
              className="font-display font-black text-3xl text-center uppercase"
              style={{ color: tierUp.accent, textShadow: `0 0 28px ${tierUp.accent.replace(")", " / 0.7)")}` }}
            >
              {tierUp.name}
            </p>
          </div>
        </div>
        </Portal>
      )}

      <button onClick={() => { hapticSelection(); navigate("/squad?tab=tribes"); }} className="flex items-center gap-1 text-xs text-muted-foreground mb-4 relative active:scale-95 transition-transform">
        <ArrowLeft size={14} /> Tribes
      </button>

      {/* HERO — the tribe's one cinematic card: fire, identity, actions */}
      <TribeHero
        tribe={tribe}
        total={fireTotal}
        members={members}
        isMember={isMember}
        isOwner={isOwner}
        parallax={parallax}
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

      {/* Owner alerts — surfaced only when something needs attention */}
      {isOwner && pendingCount > 0 && (
        <button
          onClick={() => setPendingOpen(true)}
          className="mb-3 w-full rounded-xl border border-gold/45 bg-gradient-to-r from-gold/15 to-[hsl(var(--ember))]/10 hover:from-gold/20 transition-all p-2.5 flex items-center gap-2.5 text-left"
        >
          <div className="h-8 w-8 rounded-lg bg-gold/25 border border-gold/40 flex items-center justify-center shrink-0">
            <UserCheck size={14} className="text-gold" strokeWidth={2.6} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-widest font-black text-gold">Pending requests</p>
            <p className="text-[10px] text-muted-foreground truncate">
              {pendingCount} {pendingCount === 1 ? "person wants" : "people want"} to join
            </p>
          </div>
          <span className="text-xs font-black tabular-nums text-gold">{pendingCount}</span>
        </button>
      )}
      {isOwner && reportedCount > 0 && (
        <button
          onClick={() => setReportsOpen(true)}
          className="mb-3 w-full rounded-xl border border-destructive/45 bg-gradient-to-r from-destructive/15 to-destructive/5 hover:from-destructive/20 transition-all p-2.5 flex items-center gap-2.5 text-left"
        >
          <div className="h-8 w-8 rounded-lg bg-destructive/25 border border-destructive/40 flex items-center justify-center shrink-0">
            <ShieldAlert size={14} className="text-destructive" strokeWidth={2.6} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-widest font-black text-destructive">Reported posts</p>
            <p className="text-[10px] text-muted-foreground truncate">
              {reportedCount} {reportedCount === 1 ? "post needs" : "posts need"} your review
            </p>
          </div>
          <span className="text-xs font-black tabular-nums text-destructive">{reportedCount}</span>
        </button>
      )}

      {/* TODAY — the tribe's one actionable band: check in, shared goal */}
      {(challenge || isMember || (todayPulse && todayPulse.total > 0)) && (
        <div className="surface-card p-4 mb-4">
          <div className="flex items-baseline justify-between mb-2.5">
            <span className="eyebrow">Today</span>
            <span className="flex items-center gap-3">
              {todayPulse && todayPulse.total > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold tabular-nums text-[hsl(var(--ember))]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--ember))]" />
                  {todayPulse.checked}/{todayPulse.total} lit today
                </span>
              )}
              {isOwner && (tribe.weekly_xp ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold tabular-nums text-gold">
                  <Zap size={10} fill="currentColor" /> +{(tribe.weekly_xp ?? 0).toLocaleString()} XP
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
              <div className={cn(done && "rounded-xl border border-gold/50 bg-gold/[0.06] p-3 -m-1")}>
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-[13px] font-bold">
                    {challenge.progress}/{challenge.target} check-ins together
                  </span>
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {done ? "Crushed 🏆 +25 XP each" : failed ? "last week missed" : `${daysLeft}d left · ${pct}%`}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-secondary/60 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-700",
                      failed ? "bg-muted-foreground/40" : "bg-gradient-to-r from-gold/70 to-gold",
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
        <MemberContributionStrip
          members={members.map((m) => ({
            user_id: m.user_id,
            username: m.username,
            avatar_url: m.avatar_url,
            streak: (m as any).streak ?? 0,
            role: m.role,
          }))}
        />
      )}

      {/* Meetups & events — the show-up-together loop */}
      {id && (
        <TribeEvents tribeId={id} isMember={isMember} currentUserId={profile?.user_id} />
      )}

      {/* Composer with media */}
      {isMember && (
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
      )}

      {/* Timeline — posts and milestones interleaved by time. Milestones give
          even a quiet tribe a heartbeat (founded, joins, tier-ups, wins). */}
      <div className="space-y-3">
        {posts.length === 0 && milestones.length === 0 ? (
          <EmptyState
            icon={Flame}
            title="Be the first to ignite this tribe"
            description="Share something the tribe needs to hear."
          />
        ) : (
          [
            ...posts.map((p) => ({ t: new Date(p.created_at).getTime(), post: p, ms: null as Milestone | null })),
            ...milestones.map((m) => ({ t: new Date(m.created_at).getTime(), post: null as TribePostCardPost | null, ms: m })),
          ]
            .sort((a, b) => b.t - a.t)
            .map((item) =>
              item.post ? (
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
              ) : (
                <div key={item.ms!.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-border/40 bg-card/25">
                  <span className="text-sm">{milestoneLine(item.ms!).emoji}</span>
                  <p className="text-[12px] font-semibold text-foreground/80 flex-1 min-w-0 truncate">
                    {milestoneLine(item.ms!).text}
                  </p>
                  <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                    {format(new Date(item.ms!.created_at), "MMM d")}
                  </span>
                </div>
              ),
            )
        )}
        {canLoadMore && (
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={() => { postLimitRef.current += 50; void load(); }}
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
            <div className="max-w-md mx-auto pointer-events-auto rounded-2xl border border-[hsl(var(--ember))]/45 bg-background/90 backdrop-blur-md shadow-[0_8px_32px_hsl(0_0%_0%/0.5)] p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-black truncate">{tribe.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {tribe.member_count} member{tribe.member_count === 1 ? "" : "s"}
                  {collectiveStreak > 0 ? ` · ${collectiveStreak}d collective fire` : ""}
                </p>
              </div>
              <Button size="sm" variant="ember" onClick={handleJoin} className="shrink-0">
                {tribe.visibility === "private" ? "Request to join" : "Join tribe"}
              </Button>
            </div>
          </div>
        </Portal>
      )}

      {id && (
        <>
          <TribeInviteModal tribeId={id} open={inviteOpen} onClose={() => setInviteOpen(false)} />
          <TribePendingRequestsDialog tribeId={id} open={pendingOpen} onOpenChange={setPendingOpen} onChanged={load} />
          <TribeReportsDialog tribeId={id} open={reportsOpen} onOpenChange={setReportsOpen} onChanged={load} />
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
                primary_activity: (tribe as any).primary_activity ?? null,
              }}
              members={members}
              currentUserId={profile.user_id}
              onChanged={load}
            />
          )}
        </>
      )}
    </div>
  );
};

export default TribeDetail;
