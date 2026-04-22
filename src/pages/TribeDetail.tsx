import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Crown, Loader2, Send, Trash2, Users, LogOut } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const TribeDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [tribe, setTribe] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [composer, setComposer] = useState("");
  const [posting, setPosting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  const load = async () => {
    if (!id || !profile?.user_id) return;
    setLoading(true);

    const [tRes, mRes, pRes] = await Promise.all([
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
    ]);

    setTribe((tRes as any).data);
    const m = (mRes as any).data;
    setIsMember(m?.status === "active");
    setIsOwner(m?.role === "owner");
    setPosts(((pRes as any).data) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, profile?.user_id]);

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
    <div className="min-h-full pb-8 px-4 pt-4 safe-top">
      <button
        onClick={() => navigate("/tribes")}
        className="flex items-center gap-1 text-xs text-muted-foreground mb-4"
      >
        <ArrowLeft size={14} /> Tribes
      </button>

      {/* Header */}
      <div className="rounded-2xl p-5 mb-4 border-2 border-[hsl(18_95%_58%)]/40 bg-gradient-to-br from-[hsl(18_95%_58%)]/12 via-card/80 to-[hsl(var(--gold))]/10 apex-aura-large">
        <div className="flex items-start gap-3">
          <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-[hsl(18_95%_58%)]/30 to-gold/20 border border-[hsl(18_95%_58%)]/40 flex items-center justify-center shrink-0">
            <Crown size={22} className="text-[hsl(18_95%_58%)]" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-black text-xl truncate">{tribe.name}</h1>
            {tribe.description && (
              <p className="text-xs text-muted-foreground mt-1">{tribe.description}</p>
            )}
            <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
              <Users size={10} /> {tribe.member_count} member{tribe.member_count === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          {!isMember ? (
            <Button onClick={handleJoin} size="sm" className="bg-gradient-to-r from-[hsl(18_95%_58%)] to-gold text-background font-black flex-1">
              Join Tribe
            </Button>
          ) : isOwner ? (
            <Button onClick={handleDelete} variant="destructive" size="sm" className="flex-1">
              <Trash2 size={14} /> Delete
            </Button>
          ) : (
            <Button onClick={handleLeave} variant="outline" size="sm" className="flex-1">
              <LogOut size={14} /> Leave
            </Button>
          )}
        </div>
      </div>

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
          <div className="text-center py-10 text-xs text-muted-foreground">
            No posts yet. Be the first to share.
          </div>
        ) : (
          posts.map((p) => (
            <div key={p.id} className="rounded-xl p-3 border border-border bg-card/60">
              <p className="text-sm whitespace-pre-wrap">{p.content}</p>
              <p className="text-[10px] text-muted-foreground mt-2">
                {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TribeDetail;
