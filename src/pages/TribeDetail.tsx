import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
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
import TribePostCard, { type TribePostCardPost } from "@/components/TribePostCard";
import { useModeration } from "@/hooks/use-moderation";
import TierUsername from "@/components/TierUsername";
import TribeCollectiveFlame from "@/components/TribeCollectiveFlame";
import MemberContributionStrip from "@/components/MemberContributionStrip";
import FeedTheFireCTA from "@/components/FeedTheFireCTA";
import TribeAmbientFireField from "@/components/TribeAmbientFireField";
import { useTribeFireReactor } from "@/hooks/use-tribe-fire-reactor";
import { hapticImpact } from "@/lib/haptics";
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

  // Admin check
  const { data: isAdmin } = useQuery({
    queryKey: ["user-role-admin", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
    enabled: !!user,
  });

  // Kudos given this month — shared budget across feeds (uses tribe_post_kudos)
  const { data: kudosGivenThisMonth, refetch: refetchKudos } = useQuery({
    queryKey: ["tribe-kudos-given-month", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const { count } = await supabase
        .from("tribe_post_kudos" as any)
        .select("id", { count: "exact", head: true })
        .eq("giver_id", user.id)
        .gte("created_at", startOfMonth);
      return count || 0;
    },
    enabled: !!user,
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
      supabase.from("tribes" as any).select("*").eq("id", id).maybeSingle(),
      supabase.from("tribe_members" as any).select("role, status").eq("tribe_id", id).eq("user_id", profile.user_id).maybeSingle(),
      supabase.from("tribe_posts" as any).select("*").eq("tribe_id", id).order("created_at", { ascending: false }).limit(50),
      supabase.from("tribe_members" as any).select("user_id, role").eq("tribe_id", id).eq("status", "active").limit(40),
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
        ? supabase.from("tribe_post_reactions" as any).select("post_id").eq("user_id", profile.user_id).in("post_id", postIds)
        : Promise.resolve({ data: [] as any[] } as any),
      postIds.length && profile?.user_id
        ? supabase.from("tribe_post_kudos" as any).select("post_id").eq("giver_id", profile.user_id).in("post_id", postIds)
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
        .from("tribe_members" as any)
        .select("user_id", { count: "exact", head: true })
        .eq("tribe_id", id)
        .eq("status", "pending");
      setPendingCount(count ?? 0);

      const { count: rCount } = await supabase
        .from("tribe_posts" as any)
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

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, profile?.user_id]);

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

  // Realtime: refresh on new posts/comments/kudos/reactions in this tribe
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`tribe-feed-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tribe_posts", filter: `tribe_id=eq.${id}` },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tribe_post_comments" },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tribe_post_reactions" },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tribe_post_kudos" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleScroll = () => {
    if (scrollRef.current) setParallax(Math.min(scrollRef.current.scrollTop * 0.3, 80));
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const lowerName = file.name.toLowerCase();
    const isImage = file.type.startsWith("image/") || SUPPORTED_IMAGE_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
    if (!isImage) { toast.error("Please select an image."); e.target.value = ""; return; }
    if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) { toast.error(`Max ${MAX_IMAGE_SIZE_MB}MB.`); e.target.value = ""; return; }
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
        const ext = imageFile.name.split(".").pop()?.toLowerCase() || "jpg";
        const safeExt = ["jpeg", "jpg", "png", "webp", "heic", "heif"].includes(ext) ? ext : "jpg";
        const path = `${user.id}/tribes/${Date.now()}.${safeExt}`;
        const contentType = imageFile.type || `image/${safeExt === "jpg" ? "jpeg" : safeExt}`;
        const { error: upErr } = await supabase.storage.from("feed-images").upload(path, imageFile, {
          cacheControl: "3600", upsert: false, contentType,
        });
        if (upErr) throw new Error(`Image upload failed: ${upErr.message}`);
        image_url = supabase.storage.from("feed-images").getPublicUrl(path).data.publicUrl;
      }

      if (videoFile) {
        const ext = videoFile.name.split(".").pop()?.toLowerCase() || "mp4";
        const path = `${user.id}/tribes/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("feed-images").upload(path, videoFile, {
          cacheControl: "3600", upsert: false, contentType: videoFile.type || `video/${ext}`,
        });
        if (upErr) throw new Error(`Video upload failed: ${upErr.message}`);
        video_url = supabase.storage.from("feed-images").getPublicUrl(path).data.publicUrl;
      }

      const { error } = await supabase.from("tribe_posts" as any).insert({
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
      toast.success("Posted! 🔥");
      load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to post");
    } finally {
      setPosting(false);
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
    <div ref={scrollRef} onScroll={handleScroll} className="min-h-full pb-8 px-4 pt-4 safe-top overflow-y-auto relative">
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
      )}

      <button onClick={() => navigate("/tribes")} className="flex items-center gap-1 text-xs text-muted-foreground mb-4 relative">
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
      <div className="relative rounded-2xl mb-4 p-[2px] apex-conic-border overflow-hidden">
        <div className="relative rounded-2xl p-5 overflow-hidden bg-gradient-to-br from-[hsl(18_95%_58%)]/15 via-card/85 to-[hsl(var(--gold))]/10 apex-aura-large apex-spotlight apex-embers apex-shimmer-sweep apex-portal-glow">
          <div
            className="absolute inset-0 pointer-events-none opacity-60"
            style={{
              transform: `translateY(${parallax}px)`,
              background: "radial-gradient(ellipse at top, hsl(18 95% 58% / 0.18), transparent 70%)",
            }}
          />
          <div className="relative z-10">
            <div className="flex items-start gap-3">
              <div className="relative h-16 w-16 rounded-2xl bg-gradient-to-br from-[hsl(18_95%_58%)]/35 via-gold/20 to-[hsl(18_95%_58%)]/25 border border-[hsl(18_95%_58%)]/55 flex items-center justify-center shrink-0 shadow-[0_0_22px_hsl(18_95%_58%/0.5)]">
                <Crown size={26} className="text-[hsl(18_95%_58%)] drop-shadow-[0_0_8px_hsl(18_95%_58%/0.9)]" strokeWidth={2.4} />
                <div className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-gradient-to-br from-[hsl(18_95%_58%)] to-gold border-2 border-background flex items-center justify-center shadow-[0_0_10px_hsl(18_95%_58%/0.9)] animate-pulse">
                  <Zap size={10} className="text-background" strokeWidth={3.2} fill="currentColor" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-background/40 backdrop-blur-sm border border-[hsl(18_95%_58%)]/50 mb-1.5">
                  <span className="text-[9px] font-black tracking-widest uppercase bg-gradient-to-r from-[hsl(18_95%_58%)] to-gold bg-clip-text text-transparent">
                    Apex Tribe
                  </span>
                </div>
                <h1 className="font-display font-black text-xl truncate leading-tight">{tribe.name}</h1>
                {(() => {
                  const founder = members.find((m) => m.role === "owner");
                  if (!founder) return null;
                  return (
                    <button
                      onClick={() => navigate(`/user/${founder.user_id}`)}
                      className="mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-gradient-to-r from-gold/20 to-[hsl(18_95%_58%)]/15 border border-gold/45 hover:from-gold/25 transition-colors"
                    >
                      <Crown size={9} className="text-gold" strokeWidth={2.8} fill="currentColor" />
                      <span className="text-[9px] font-black tracking-widest uppercase text-gold">Founder</span>
                      <TierUsername
                        username={founder.username}
                        tier={founder.status_tier || "recruit"}
                        className="text-[10px] font-bold truncate max-w-[120px]"
                      />
                    </button>
                  );
                })()}
                {tribe.description && (
                  <p className="text-xs text-foreground/75 mt-1 leading-snug">{tribe.description}</p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[hsl(18_95%_58%)]/12 border border-[hsl(18_95%_58%)]/30">
                    <Users size={10} className="text-[hsl(18_95%_58%)]" />
                    <span className="text-[10px] font-bold tabular-nums text-[hsl(18_95%_58%)]">
                      {tribe.member_count} member{tribe.member_count === 1 ? "" : "s"}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate(`/tribes/${id}/battles`)}
              className="mt-4 w-full rounded-xl border border-[hsl(18_95%_58%)]/45 bg-gradient-to-r from-[hsl(18_95%_58%)]/[0.10] to-gold/[0.06] hover:from-[hsl(18_95%_58%)]/15 hover:to-gold/10 transition-all p-2.5 flex items-center gap-2.5 text-left"
            >
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[hsl(18_95%_58%)] to-gold flex items-center justify-center shrink-0 shadow-[0_0_10px_hsl(18_95%_58%/0.5)]">
                <Swords size={14} className="text-background" strokeWidth={2.6} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-widest font-black bg-gradient-to-r from-[hsl(18_95%_58%)] to-gold bg-clip-text text-transparent">
                  Tribe Battles
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  Challenge another tribe to a collective XP battle
                </p>
              </div>
              <ArrowLeft size={14} className="text-muted-foreground rotate-180" />
            </button>

            {isOwner && pendingCount > 0 && (
              <button
                onClick={() => setPendingOpen(true)}
                className="mt-3 w-full rounded-xl border border-gold/45 bg-gradient-to-r from-gold/15 to-[hsl(18_95%_58%)]/10 hover:from-gold/20 transition-all p-2.5 flex items-center gap-2.5 text-left"
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
                className="mt-3 w-full rounded-xl border border-destructive/45 bg-gradient-to-r from-destructive/15 to-destructive/5 hover:from-destructive/20 transition-all p-2.5 flex items-center gap-2.5 text-left"
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

            <div className="flex gap-2 mt-3">
              {!isMember ? (
                <Button onClick={handleJoin} size="sm" variant="ember" className="flex-1">
                  Join Tribe
                </Button>
              ) : isOwner ? (
                <>
                  <Button onClick={() => setManageOpen(true)} size="sm" variant="gold-outline"
                    className="flex-1">
                    <Settings size={14} /> Manage
                  </Button>
                  <Button onClick={() => setInviteOpen(true)} size="sm" variant="ember-outline"
                    className="flex-1">
                    <UserPlus size={14} /> Invite
                  </Button>
                  <Button onClick={handleDelete} variant="destructive" size="sm" className="px-3">
                    <Trash2 size={14} />
                  </Button>
                </>
              ) : (
                <>
                  <Button onClick={() => setInviteOpen(true)} size="sm" variant="ember-outline"
                    className="flex-1">
                    <UserPlus size={14} /> Invite
                  </Button>
                  <Button onClick={handleLeave} variant="ember-outline" size="sm" className="flex-1 opacity-80 hover:opacity-100">
                    <LogOut size={14} /> Leave
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>



      {/* (Hero flame moved to top of page) */}

      {/* Members row */}
      {members.length > 0 && (
        <div className="mb-4">
          <h2 className="text-[10px] font-black tracking-widest uppercase text-muted-foreground mb-2">
            Members · {members.length}
          </h2>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar">
            {members.map((m) => (
              <button key={m.user_id} onClick={() => navigate(`/user/${m.user_id}`)}
                className="flex flex-col items-center gap-1 shrink-0 w-14">
                <div className={`relative h-12 w-12 rounded-full border-2 ${m.role === "owner" ? "border-gold shadow-[0_0_12px_hsl(42_78%_54%/0.6)]" : "border-[hsl(18_95%_58%)]/30"} bg-secondary overflow-hidden`}>
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt={m.username} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-[10px] font-black text-muted-foreground">
                      {m.username.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  {m.role === "owner" && (
                    <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 px-1 py-px rounded-sm bg-gradient-to-r from-gold to-[hsl(18_95%_58%)] shadow-[0_0_6px_hsl(42_78%_54%/0.7)] flex items-center gap-0.5">
                      <Crown size={6} className="text-background" strokeWidth={3} fill="currentColor" />
                      <span className="text-[6px] font-black tracking-wider uppercase text-background leading-none">Founder</span>
                    </div>
                  )}
                  {m.role === "admin" && (
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1 py-px rounded-sm bg-[hsl(18_95%_58%)]/90">
                      <Shield size={6} className="text-background" />
                    </div>
                  )}
                </div>
                <TierUsername
                  username={m.username}
                  tier={m.status_tier || "recruit"}
                  showAt={false}
                  className={`text-[9px] truncate w-full text-center ${m.role === "owner" ? "font-black" : ""}`}
                />
              </button>
            ))}
          </div>
          <div className="apex-divider mt-3" />
        </div>
      )}

      {/* Composer with media */}
      {isMember && (
        <div className="mb-4 rounded-2xl p-3 border border-[hsl(18_95%_58%)]/25 bg-card/70">
          <Textarea
            value={composer}
            onChange={(e) => setComposer(e.target.value)}
            placeholder="Share with your tribe…"
            rows={3}
            maxLength={500}
            className="border-0 bg-transparent focus-visible:ring-0 resize-none"
          />

          {/* Image preview */}
          {imagePreview && (
            <div className="relative mt-2 rounded-xl overflow-hidden">
              <img src={imagePreview} alt="Preview" className="w-full max-h-56 object-cover" />
              <button onClick={() => { setImageFile(null); setImagePreview(null); }}
                className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 text-white flex items-center justify-center text-xs hover:bg-black/80">
                <X size={14} />
              </button>
            </div>
          )}

          {/* Video preview */}
          {videoPreview && (
            <div className="relative mt-2 rounded-xl overflow-hidden bg-black">
              <video src={videoPreview} controls className="w-full max-h-56 object-contain" />
              <button onClick={() => { setVideoFile(null); setVideoPreview(null); }}
                className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 text-white flex items-center justify-center text-xs hover:bg-black/80">
                <X size={14} />
              </button>
            </div>
          )}

          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                hidden
                onChange={handleImageSelect}
              />
              <input
                ref={videoInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                hidden
                onChange={handleVideoSelect}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={posting || !!videoFile}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-[hsl(18_95%_58%)] hover:bg-[hsl(18_95%_58%)]/10 transition-colors disabled:opacity-40"
                aria-label="Add image"
              >
                <ImageIcon size={16} />
              </button>
              <button
                type="button"
                onClick={() => videoInputRef.current?.click()}
                disabled={posting || !!imageFile}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-[hsl(18_95%_58%)] hover:bg-[hsl(18_95%_58%)]/10 transition-colors disabled:opacity-40"
                aria-label="Add video"
              >
                <VideoIcon size={16} />
              </button>
              <span className="text-[10px] text-muted-foreground ml-1">{composer.length}/500</span>
            </div>
            <Button
              onClick={handlePost}
              size="sm"
              disabled={posting || (!composer.trim() && !imageFile && !videoFile)}
              className="bg-gradient-to-r from-[hsl(18_95%_58%)] to-gold text-background font-bold"
            >
              {posting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Post
            </Button>
          </div>
        </div>
      )}

      {/* Posts */}
      <div className="space-y-3">
        {posts.length === 0 ? (
          <div className="rounded-2xl p-8 text-center border border-[hsl(18_95%_58%)]/30 bg-gradient-to-br from-[hsl(18_95%_58%)]/8 via-card/50 to-gold/5 shadow-[0_0_24px_hsl(18_95%_58%/0.2)]">
            <Flame size={28} className="mx-auto mb-2 text-[hsl(18_95%_58%)] drop-shadow-[0_0_8px_hsl(18_95%_58%/0.7)]" />
            <p className="font-display font-black text-sm bg-gradient-to-r from-[hsl(18_95%_58%)] to-gold bg-clip-text text-transparent">
              Be the first to ignite this tribe
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Share something the tribe needs to hear.
            </p>
          </div>
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
