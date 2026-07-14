import { useEffect, useRef, useState } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import TribeInviteModal from "@/components/TribeInviteModal";
import TribePendingRequestsDialog from "@/components/TribePendingRequestsDialog";
import TribeReportsDialog from "@/components/TribeReportsDialog";
import TribeManageDialog from "@/components/TribeManageDialog";
import TribeEvents from "@/components/tribe/TribeEvents";
import TribeMembersRow from "@/components/tribe/TribeMembersRow";
import EmptyState from "@/components/ui/empty-state";
import TribeComposer from "@/components/tribe/TribeComposer";
import TribeHeader from "@/components/tribe/TribeHeader";
import { downscaleImage } from "@/lib/downscale-image";
import TribePostCard, { type TribePostCardPost } from "@/components/TribePostCard";
import { useModeration } from "@/hooks/use-moderation";
import TierUsername from "@/components/TierUsername";
import TribeCollectiveFlame from "@/components/TribeCollectiveFlame";
import MemberContributionStrip from "@/components/MemberContributionStrip";
import FeedTheFireCTA from "@/components/FeedTheFireCTA";
import TribeAmbientFireField from "@/components/TribeAmbientFireField";
import { useTribeFireReactor } from "@/hooks/use-tribe-fire-reactor";
import { hapticImpact, hapticSelection, hapticNotification } from "@/lib/haptics";
import { fetchTribeCollectiveStreak, collectiveAccent, collectiveStreakTier, collectiveTierName } from "@/lib/tribe-streak";

interface Member {
  user_id: string;
  username: string;
  avatar_url: string | null;
  status_tier: string | null;
  role: string;
}

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

  // Tribe-level verified discipline — which members are HealthKit-verified.
  // Reuses the verified_authors RPC; keyed by member ids (TanStack compares by value).
  const { data: verifiedMemberIds } = useQuery({
    queryKey: ["tribe-verified-members", members.map((m) => m.user_id)],
    enabled: members.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("verified_authors", { p_ids: members.map((m) => m.user_id) });
      if (error) return new Set<string>();
      return new Set((data as string[]) ?? []);
    },
  });

  const kudosRemaining = Math.max(0, 2 - (kudosGivenThisMonth || 0));
  const canKudos = !!profile && (
    (profile as any).is_apex_subscriber === true ||
    profile.status_tier === "apex" ||
    profile.status_tier === "legend"
  );

  const load = async () => {
    if (!id || !profile?.user_id) return;
    setLoading(true);

    const [tRes, mRes, pRes, allMRes] = await Promise.all([
      supabase.from("tribes").select("*").eq("id", id).maybeSingle(),
      supabase.from("tribe_members").select("role, status").eq("tribe_id", id).eq("user_id", profile.user_id).maybeSingle(),
      supabase.from("tribe_posts").select("*").eq("tribe_id", id).order("created_at", { ascending: false }).limit(50),
      supabase.from("tribe_members").select("user_id, role").eq("tribe_id", id).eq("status", "active").limit(40),
    ]);

    setTribe((tRes as any).data);
    const m = (mRes as any).data;
    const member = m?.status === "active";
    setIsMember(member);
    setIsOwner(m?.role === "owner");

    const rawMembers = ((allMRes as any).data) ?? [];
    const memberIds = rawMembers.map((r: any) => r.user_id);
    const { data: memberProfiles } = memberIds.length
      ? await supabase.from("profiles").select("user_id, username, avatar_url, status_tier").in("user_id", memberIds)
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

    // Tribe collective streak — sum of every active member's streak
    try {
      const total = await fetchTribeCollectiveStreak(id);
      setCollectiveStreak(total);
    } catch {
      setCollectiveStreak(0);
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
          accent: collectiveAccent(next),
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
        const upload = await downscaleImage(imageFile, { maxDim: 1280, quality: 0.8 });
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
      toast.error(e?.message || "Failed to post");
    } finally {
      setPosting(false);
      setUploadPhase(null);
    }
  };

  const handleJoin = async () => {
    const { data, error } = await supabase.rpc("join_tribe" as any, { p_tribe_id: id });
    if (error) { toast.error(error.message); return; }
    if (data === "pending") toast.success("Request sent");
    else toast.success("Joined!");
    load();
  };

  const handleLeave = async () => {
    const { error } = await supabase.rpc("leave_tribe" as any, { p_tribe_id: id });
    if (error) { toast.error(error.message); return; }
    toast.success("Left the tribe");
    load();
  };

  const handleDelete = async () => {
    if (!confirm("Delete this tribe? This cannot be undone.")) return;
    const { error } = await supabase.rpc("delete_tribe" as any, { p_tribe_id: id });
    if (error) { toast.error(error.message); return; }
    toast.success("Tribe deleted");
    navigate("/tribes");
  };

  const handleChanged = () => {
    refetchKudos();
    load();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={20} className="animate-spin text-gold" />
      </div>
    );
  }

  if (!tribe) {
    return <div className="text-center py-12 text-sm text-muted-foreground">Tribe not found.</div>;
  }

  // Tier-reactive page tint based on tribe's collective heat
  const pageTint = collectiveStreak >= 30
    ? collectiveAccent(collectiveStreak)
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
          <TribeAmbientFireField total={collectiveStreak} accent={pageTint} />
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
              className="text-[10px] uppercase tracking-[0.3em] font-black text-center mb-1"
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

      <button onClick={() => { hapticSelection(); navigate("/tribes"); }} className="flex items-center gap-1 text-xs text-muted-foreground mb-4 relative active:scale-95 transition-transform">
        <ArrowLeft size={14} /> Tribes
      </button>

      {/* HERO: the flame IS the tribe — name renders under the flame */}
      <div className="mb-2 relative">
        <TribeCollectiveFlame
          variant="hero"
          total={collectiveStreak}
          memberCount={tribe?.member_count}
          tribeName={tribe?.name}
          reactor={fireReactor}
        />
      </div>

      {/* Tiny LIVE indicator under the hero */}
      <div className="flex items-center justify-center gap-1.5 mb-3">
        <span
          className={`h-1.5 w-1.5 rounded-full ${fireReactor.connected ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground/40"}`}
          style={fireReactor.connected ? { boxShadow: "0 0 8px hsl(142 76% 50% / 0.8)" } : undefined}
        />
        <span className="text-[9px] uppercase tracking-widest font-black text-muted-foreground/80">
          {fireReactor.connected ? "Live" : "Connecting…"}
        </span>
      </div>

      {/* Feed-the-Fire CTA — only shows if user hasn't checked in today */}
      {isMember && (
        <FeedTheFireCTA
          accent={collectiveStreak >= 30 ? collectiveAccent(collectiveStreak) : undefined}
          tribeName={tribe?.name}
        />
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

      {/* Cinematic Apex header */}
      <TribeHeader
        tribe={tribe}
        parallax={parallax}
        members={members}
        isMember={isMember}
        isOwner={isOwner}
        canClaim={
          isMember &&
          ((profile as any)?.is_apex_subscriber === true ||
            profile?.status_tier === "apex" ||
            profile?.status_tier === "legend")
        }
        pendingCount={pendingCount}
        reportedCount={reportedCount}
        onNavigateUser={(uid) => navigate(`/user/${uid}`)}
        onNavigateBattles={() => navigate(`/tribes/${id}/battles`)}
        onClaim={async () => {
          const { error } = await supabase.rpc("claim_paused_tribe" as any, { p_tribe_id: id });
          if (error) { toast.error(error.message); return; }
          toast.success(`You now lead ${tribe.name} — fire revived 🔥`);
          load();
        }}
        onOpenPending={() => setPendingOpen(true)}
        onOpenReports={() => setReportsOpen(true)}
        onJoin={handleJoin}
        onManage={() => setManageOpen(true)}
        onInvite={() => setInviteOpen(true)}
        onDelete={handleDelete}
        onLeave={handleLeave}
      />



      {/* (Hero flame moved to top of page) */}

      {/* Members row */}
      <TribeMembersRow members={members} onMemberClick={(uid) => navigate(`/user/${uid}`)} verifiedIds={verifiedMemberIds} />

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

      {/* Posts */}
      <div className="space-y-3">
        {posts.length === 0 ? (
          <EmptyState
            icon={Flame}
            title="Be the first to ignite this tribe"
            description="Share something the tribe needs to hear."
          />
        ) : (
          posts.map((p) => (
            <TribePostCard
              key={p.id}
              post={p}
              isMember={isMember}
              isOwner={isOwner}
              isAdmin={!!isAdmin}
              canKudos={canKudos}
              kudosRemaining={kudosRemaining}
              onChanged={handleChanged}
            />
          ))
        )}
      </div>

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
