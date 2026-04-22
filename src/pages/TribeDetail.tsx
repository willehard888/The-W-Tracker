import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
  Heart,
  Flame,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import TribeInviteModal from "@/components/TribeInviteModal";

interface Member {
  user_id: string;
  username: string;
  avatar_url: string | null;
  status_tier: string | null;
  role: string;
}

interface Post {
  id: string;
  content: string | null;
  user_id: string;
  created_at: string;
  likes_count: number;
  author?: { username: string; avatar_url: string | null; status_tier: string | null };
  liked?: boolean;
}

const TribeDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [parallax, setParallax] = useState(0);
  const [tribe, setTribe] = useState<any>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [composer, setComposer] = useState("");
  const [posting, setPosting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [likingId, setLikingId] = useState<string | null>(null);

  const load = async () => {
    if (!id || !profile?.user_id) return;
    setLoading(true);

    const [tRes, mRes, pRes, allMRes] = await Promise.all([
      supabase.from("tribes" as any).select("*").eq("id", id).maybeSingle(),
      supabase
        .from("tribe_members" as any)
        .select("role, status")
        .eq("tribe_id", id)
        .eq("user_id", profile.user_id)
        .maybeSingle(),
      supabase
        .from("tribe_posts" as any)
        .select("*")
        .eq("tribe_id", id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("tribe_members" as any)
        .select("user_id, role")
        .eq("tribe_id", id)
        .eq("status", "active")
        .limit(40),
    ]);

    setTribe((tRes as any).data);
    const m = (mRes as any).data;
    setIsMember(m?.status === "active");
    setIsOwner(m?.role === "owner");

    const rawMembers = ((allMRes as any).data) ?? [];
    const memberIds = rawMembers.map((r: any) => r.user_id);
    const { data: memberProfiles } = memberIds.length
      ? await supabase
          .from("profiles")
          .select("user_id, username, avatar_url, status_tier")
          .in("user_id", memberIds)
      : { data: [] as any[] };
    const profMap = new Map(((memberProfiles as any) ?? []).map((p: any) => [p.user_id, p]));
    setMembers(
      rawMembers
        .map((r: any) => {
          const p = profMap.get(r.user_id);
          return p ? { ...(p as any), role: r.role } : null;
        })
        .filter(Boolean) as Member[],
    );

    const rawPosts = ((pRes as any).data) ?? [];
    const postIds = rawPosts.map((p: any) => p.id);
    const authorIds = Array.from(new Set(rawPosts.map((p: any) => p.user_id as string)));
    const [authorRes, reactionsRes] = await Promise.all([
      authorIds.length
        ? supabase
            .from("profiles")
            .select("user_id, username, avatar_url, status_tier")
            .in("user_id", authorIds)
        : Promise.resolve({ data: [] as any[] } as any),
      postIds.length
        ? supabase
            .from("tribe_post_reactions" as any)
            .select("post_id")
            .eq("user_id", profile.user_id)
            .in("post_id", postIds)
        : Promise.resolve({ data: [] as any[] } as any),
    ]);
    const aMap = new Map(((authorRes as any).data ?? []).map((a: any) => [a.user_id, a]));
    const likedSet = new Set(((reactionsRes as any).data ?? []).map((r: any) => r.post_id));
    setPosts(
      rawPosts.map((p: any) => ({
        ...p,
        author: aMap.get(p.user_id) ?? undefined,
        liked: likedSet.has(p.id),
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, profile?.user_id]);

  const handleScroll = () => {
    if (scrollRef.current) {
      setParallax(Math.min(scrollRef.current.scrollTop * 0.3, 80));
    }
  };

  const handlePost = async () => {
    const text = composer.trim();
    if (!text) return;
    setPosting(true);
    const { error } = await supabase.from("tribe_posts" as any).insert({
      tribe_id: id,
      user_id: profile.user_id,
      content: text,
    });
    setPosting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setComposer("");
    load();
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

  const handleLike = async (post: Post) => {
    if (!profile?.user_id || likingId) return;
    setLikingId(post.id);
    if (post.liked) {
      await supabase
        .from("tribe_post_reactions" as any)
        .delete()
        .eq("post_id", post.id)
        .eq("user_id", profile.user_id);
      setPosts((arr) =>
        arr.map((p) => (p.id === post.id ? { ...p, liked: false, likes_count: Math.max(0, p.likes_count - 1) } : p)),
      );
    } else {
      const { error } = await supabase.from("tribe_post_reactions" as any).insert({
        post_id: post.id,
        user_id: profile.user_id,
      });
      if (!error) {
        setPosts((arr) =>
          arr.map((p) => (p.id === post.id ? { ...p, liked: true, likes_count: p.likes_count + 1 } : p)),
        );
      }
    }
    setLikingId(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={20} className="animate-spin text-gold" />
      </div>
    );
  }

  if (!tribe) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        Tribe not found.
      </div>
    );
  }

  return (
    <div ref={scrollRef} onScroll={handleScroll} className="min-h-full pb-8 px-4 pt-4 safe-top overflow-y-auto">
      <button
        onClick={() => navigate("/tribes")}
        className="flex items-center gap-1 text-xs text-muted-foreground mb-4"
      >
        <ArrowLeft size={14} /> Tribes
      </button>

      {/* Cinematic Apex header with parallax */}
      <div className="relative rounded-2xl mb-4 p-[2px] apex-conic-border overflow-hidden">
        <div className="relative rounded-2xl p-5 overflow-hidden bg-gradient-to-br from-[hsl(18_95%_58%)]/15 via-card/85 to-[hsl(var(--gold))]/10 apex-aura-large apex-spotlight apex-embers apex-shimmer-sweep apex-portal-glow">
          {/* Parallax layer */}
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
                <h1 className="font-display font-black text-xl truncate leading-tight">
                  {tribe.name}
                </h1>
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

            <div className="flex gap-2 mt-4">
              {!isMember ? (
                <Button onClick={handleJoin} size="sm" className="bg-gradient-to-r from-[hsl(18_95%_58%)] to-gold text-background font-black flex-1 shadow-[0_0_16px_hsl(18_95%_58%/0.5)]">
                  Join Tribe
                </Button>
              ) : isOwner ? (
                <>
                  <Button
                    onClick={() => setInviteOpen(true)}
                    size="sm"
                    variant="outline"
                    className="flex-1 border-[hsl(18_95%_58%)]/40 hover:bg-[hsl(18_95%_58%)]/10 text-[hsl(18_95%_58%)]"
                  >
                    <UserPlus size={14} /> Invite
                  </Button>
                  <Button onClick={handleDelete} variant="destructive" size="sm" className="flex-1">
                    <Trash2 size={14} /> Delete
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={() => setInviteOpen(true)}
                    size="sm"
                    variant="outline"
                    className="flex-1 border-[hsl(18_95%_58%)]/40 hover:bg-[hsl(18_95%_58%)]/10 text-[hsl(18_95%_58%)]"
                  >
                    <UserPlus size={14} /> Invite
                  </Button>
                  <Button onClick={handleLeave} variant="outline" size="sm" className="flex-1 border-[hsl(18_95%_58%)]/30 hover:bg-[hsl(18_95%_58%)]/10">
                    <LogOut size={14} /> Leave
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Members row */}
      {members.length > 0 && (
        <div className="mb-4">
          <h2 className="text-[10px] font-black tracking-widest uppercase text-muted-foreground mb-2">
            Members · {members.length}
          </h2>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar">
            {members.map((m) => (
              <button
                key={m.user_id}
                onClick={() => navigate(`/user/${m.user_id}`)}
                className="flex flex-col items-center gap-1 shrink-0 w-14"
              >
                <div className={`relative h-12 w-12 rounded-full border-2 ${m.role === "owner" ? "border-gold shadow-[0_0_12px_hsl(42_78%_54%/0.6)]" : "border-[hsl(18_95%_58%)]/30"} bg-secondary overflow-hidden`}>
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt={m.username} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-[10px] font-black text-muted-foreground">
                      {m.username.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  {m.role === "owner" && (
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1 py-px rounded-sm bg-gold/90">
                      <Crown size={6} className="text-background" />
                    </div>
                  )}
                </div>
                <p className="text-[9px] text-muted-foreground truncate w-full text-center">
                  {m.username}
                </p>
              </button>
            ))}
          </div>
          <div className="apex-divider mt-3" />
        </div>
      )}

      {/* Composer */}
      {isMember && (
        <div className="mb-4 rounded-xl p-3 border border-border bg-card/60">
          <Textarea
            value={composer}
            onChange={(e) => setComposer(e.target.value)}
            placeholder="Share with your tribe…"
            rows={3}
            maxLength={500}
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-muted-foreground">{composer.length}/500</span>
            <Button onClick={handlePost} size="sm" disabled={posting || !composer.trim()}>
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
          posts.map((p) => {
            const isApexAuthor = p.author?.status_tier === "apex" || p.author?.status_tier === "legend";
            return (
              <div
                key={p.id}
                className={`rounded-xl p-3 border bg-card/60 ${isApexAuthor ? "border-[hsl(18_95%_58%)]/40 shadow-[0_0_12px_hsl(18_95%_58%/0.18)]" : "border-border"}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={() => p.author && navigate(`/user/${p.user_id}`)}
                    className="h-7 w-7 rounded-full bg-secondary border border-border overflow-hidden shrink-0"
                  >
                    {p.author?.avatar_url ? (
                      <img src={p.author.avatar_url} alt={p.author.username} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-[9px] font-black text-muted-foreground">
                        {(p.author?.username ?? "?").slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold truncate">@{p.author?.username ?? "user"}</p>
                      {isApexAuthor && (
                        <span className="inline-flex items-center gap-0.5 px-1 py-px rounded bg-[hsl(18_95%_58%)]/15 border border-[hsl(18_95%_58%)]/40">
                          <Zap size={7} className="text-[hsl(18_95%_58%)]" fill="currentColor" />
                          <span className="text-[8px] font-black tracking-wider uppercase text-[hsl(18_95%_58%)]">Apex</span>
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
                <p className="text-sm whitespace-pre-wrap">{p.content}</p>
                {isMember && (
                  <button
                    onClick={() => handleLike(p)}
                    disabled={likingId === p.id}
                    className={`mt-2 inline-flex items-center gap-1 text-[11px] font-bold transition-colors ${p.liked ? "text-[hsl(18_95%_58%)]" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <Heart size={12} fill={p.liked ? "currentColor" : "none"} />
                    {p.likes_count}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {id && (
        <TribeInviteModal
          tribeId={id}
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
        />
      )}
    </div>
  );
};

export default TribeDetail;
