import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { avatarUrl } from "@/lib/img";
import { downscaleImage } from "@/lib/downscale-image";
import { toast } from "sonner";
import { Crown, Loader2, Settings, Shield, ShieldOff, UserMinus, Lock, Image as ImageIcon, Trash2, Upload } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useModeration } from "@/hooks/use-moderation";
import { friendlyError } from "@/lib/error-copy";

interface Member {
  user_id: string;
  username: string;
  avatar_url: string | null;
  role: string;
}

interface Props {
  tribeId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tribe: {
    name: string;
    description: string | null;
    visibility: string;
    cover_url: string | null;
  };
  members: Member[];
  currentUserId: string;
  onChanged: () => void;
}

const SUPPORTED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const MAX_COVER_SIZE_MB = 8;

const TribeManageDialog = ({ tribeId, open, onOpenChange, tribe, members, currentUserId, onChanged }: Props) => {
  const { user } = useAuth();
  const moderation = useModeration();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(tribe.name);
  const [description, setDescription] = useState(tribe.description ?? "");
  // All tribes are private — visibility is locked.
  const visibility = "private" as const;
  const [coverUrl, setCoverUrl] = useState(tribe.cover_url ?? "");
  const [coverPreview, setCoverPreview] = useState<string | null>(tribe.cover_url ?? null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(tribe.name);
      setDescription(tribe.description ?? "");
      setCoverUrl(tribe.cover_url ?? "");
      setCoverPreview(tribe.cover_url ?? null);
      setCoverFile(null);
    }
  }, [open, tribe]);

  const otherMembers = members.filter((m) => m.user_id !== currentUserId && m.role !== "owner");
  const adminCount = otherMembers.filter((m) => m.role === "admin").length;

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const lower = file.name.toLowerCase();
    const isImage = file.type.startsWith("image/") || SUPPORTED_IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
    if (!isImage) {
      toast.error("Please select an image (JPG, PNG, WEBP).");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_COVER_SIZE_MB * 1024 * 1024) {
      toast.error(`Max ${MAX_COVER_SIZE_MB}MB.`);
      e.target.value = "";
      return;
    }
    setCoverFile(file);
    const reader = new FileReader();
    reader.onload = () => setCoverPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemoveCover = () => {
    setCoverFile(null);
    setCoverPreview(null);
    setCoverUrl("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSaveMeta = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 3 || trimmed.length > 40) {
      toast.error("Name must be 3–40 characters");
      return;
    }
    if (!user) {
      toast.error("Not signed in");
      return;
    }
    setSavingMeta(true);
    try {
      let nextCoverUrl: string | null = coverUrl.trim() || null;
      const willClear = !coverFile && !coverPreview;

      // If a new file was selected, moderate + upload it first.
      if (coverFile) {
        setUploading(true);
        const outcome = await moderation.moderateImage({ file: coverFile, kind: "feed_post" });
        if (outcome.blocked) {
          throw new Error(outcome.friendlyMessage ?? "Image rejected by content policy");
        }
        const upload = await downscaleImage(coverFile, { maxDim: 1280, quality: 0.8 });
        const ext = upload.name.split(".").pop()?.toLowerCase() || "jpg";
        const safeExt = ["jpeg", "jpg", "png", "webp"].includes(ext) ? ext : "jpg";
        const path = `${user.id}/tribe-covers/${tribeId}-${Date.now()}.${safeExt}`;
        const contentType = upload.type || `image/${safeExt === "jpg" ? "jpeg" : safeExt}`;
        const { error: upErr } = await supabase.storage.from("feed-images").upload(path, upload, {
          cacheControl: "3600",
          upsert: false,
          contentType,
        });
        if (upErr) throw new Error(`Upload failed: ${upErr.message}`);
        nextCoverUrl = supabase.storage.from("feed-images").getPublicUrl(path).data.publicUrl;
        setUploading(false);
      }

      const { error } = await supabase.rpc("update_tribe" as any, {
        p_tribe_id: tribeId,
        p_name: trimmed,
        p_description: description,
        p_visibility: visibility,
        p_cover_url: nextCoverUrl,
        p_clear_cover: willClear,
      });
      if (error) throw error;
      toast.success("Tribe updated");
      setCoverFile(null);
      onChanged();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(friendlyError(e, "Failed to update tribe"));
    } finally {
      setSavingMeta(false);
      setUploading(false);
    }
  };

  const handleRoleChange = async (userId: string, role: "admin" | "member") => {
    setBusyId(userId);
    try {
      const { error } = await supabase.rpc("set_tribe_member_role" as any, {
        p_tribe_id: tribeId,
        p_user_id: userId,
        p_role: role,
      });
      if (error) throw error;
      toast.success(role === "admin" ? "Promoted to admin" : "Removed admin role");
      onChanged();
    } catch (e: any) {
      toast.error(friendlyError(e, "Failed to update role"));
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (userId: string, username: string) => {
    if (!confirm(`Remove ${username} from this tribe?`)) return;
    setBusyId(userId);
    try {
      const { error } = await supabase.rpc("remove_tribe_member" as any, {
        p_tribe_id: tribeId,
        p_user_id: userId,
      });
      if (error) throw error;
      toast.success(`${username} removed`);
      onChanged();
    } catch (e: any) {
      toast.error(friendlyError(e, "Failed to remove member"));
    } finally {
      setBusyId(null);
    }
  };

  const busy = savingMeta || uploading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings size={16} className="text-gold" /> Manage tribe
          </DialogTitle>
          <DialogDescription>Edit tribe details, cover photo, and member roles.</DialogDescription>
        </DialogHeader>

        {/* Cover photo uploader */}
        <div>
          <Label className="text-xs mb-2 block">Cover photo</Label>
          <div className="relative rounded-xl overflow-hidden border border-border bg-card/40 aspect-[16/9]">
            {coverPreview ? (
              <>
                <img loading="lazy" decoding="async" src={coverPreview} alt="Cover preview" className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
                <div className="absolute bottom-2 right-2 flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={busy}
                    className="h-8 px-2.5 rounded-md bg-background/85 backdrop-blur border border-border text-[11px] font-bold inline-flex items-center gap-1 hover:bg-background transition-colors disabled:opacity-40"
                  >
                    <Upload size={11} /> Change
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveCover}
                    disabled={busy}
                    className="h-8 w-8 rounded-md bg-background/85 backdrop-blur border border-border text-destructive inline-flex items-center justify-center hover:bg-destructive/10 transition-colors disabled:opacity-40"
                    aria-label="Remove cover"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:text-gold hover:bg-gold/5 transition-colors disabled:opacity-40"
              >
                <ImageIcon size={22} />
                <span className="text-[11px] font-bold uppercase tracking-wider">Add cover photo</span>
                <span className="text-[10px] text-muted-foreground/70">JPG, PNG, WEBP · max {MAX_COVER_SIZE_MB}MB</span>
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={handleCoverSelect}
            />
          </div>
        </div>

        {/* Metadata edit */}
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={280}
              rows={3}
              className="mt-1 resize-none"
            />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Privacy</Label>
            <div className="rounded-lg border border-gold/40 bg-gold/8 p-2.5 flex items-center gap-2.5">
              <Lock size={14} className="text-gold shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-gold">Private — invite only</p>
                <p className="text-[10px] text-muted-foreground">All tribes require approval to join.</p>
              </div>
            </div>
          </div>
          <Button onClick={handleSaveMeta} disabled={busy} className="w-full" variant="coal">
            {busy ? <Loader2 size={14} className="animate-spin" /> : null}
            {uploading ? "Uploading…" : savingMeta ? "Saving…" : "Save changes"}
          </Button>
        </div>

        <div className="apex-divider my-2" />

        {/* Roles */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Members & roles</h3>
            <span className="text-[10px] text-muted-foreground tabular-nums">{adminCount}/2 admins</span>
          </div>

          {otherMembers.length === 0 ? (
            <p className="text-xs text-muted-foreground py-3 text-center">No other members yet.</p>
          ) : (
            <div className="space-y-1.5">
              {otherMembers.map((m) => {
                const isAdmin = m.role === "admin";
                const promoteDisabled = !isAdmin && adminCount >= 2;
                return (
                  <div key={m.user_id} className="flex items-center gap-2 rounded-lg border border-border bg-card/40 p-2">
                    <div className="h-8 w-8 rounded-full bg-secondary overflow-hidden shrink-0">
                      {m.avatar_url ? (
                        <img loading="lazy" decoding="async" src={avatarUrl(m.avatar_url, 48)} alt={m.username} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-[10px] font-black text-muted-foreground">
                          {m.username.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{m.username}</p>
                      {isAdmin && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-gold">
                          <Crown size={8} /> ADMIN
                        </span>
                      )}
                    </div>
                    {busyId === m.user_id ? (
                      <Loader2 size={14} className="animate-spin text-muted-foreground" />
                    ) : isAdmin ? (
                      <>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]"
                          onClick={() => handleRoleChange(m.user_id, "member")}>
                          <ShieldOff size={12} /> Demote
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px] text-destructive hover:text-destructive"
                          onClick={() => handleRemove(m.user_id, m.username)}>
                          <UserMinus size={12} />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-[10px] text-gold hover:text-gold disabled:opacity-40"
                          disabled={promoteDisabled}
                          onClick={() => handleRoleChange(m.user_id, "admin")}
                          title={promoteDisabled ? "Max 2 admins reached" : "Promote to admin"}
                        >
                          <Shield size={12} /> Promote
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px] text-destructive hover:text-destructive"
                          onClick={() => handleRemove(m.user_id, m.username)}>
                          <UserMinus size={12} />
                        </Button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TribeManageDialog;
