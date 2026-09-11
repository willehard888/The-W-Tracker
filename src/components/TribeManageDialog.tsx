import { useEffect, useRef, useState } from "react";
import { BottomSheet } from "@/components/ui/sheet-bottom";
import { Button } from "@/components/ui/button";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { avatarUrl } from "@/lib/img";
import { useSignedMediaUrl } from "@/lib/signed-url";
import { downscaleImage } from "@/lib/downscale-image";
import { toast } from "sonner";
import { Crown, Shield, ShieldOff, UserMinus, Lock, Globe, Image as ImageIcon, Trash2, Upload } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useModeration } from "@/hooks/use-moderation";
import { friendlyError } from "@/lib/error-copy";
import { cn } from "@/lib/utils";
import { TRIBE_ACTIVITY_GROUPS } from "@/lib/tribe-activities";

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
    primary_activity?: string | null;
  };
  members: Member[];
  currentUserId: string;
  onChanged: () => void;
}

const SUPPORTED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const MAX_COVER_SIZE_MB = 8;

const LABEL = "text-[11px] font-bold text-muted-foreground";

const TribeManageDialog = ({ tribeId, open, onOpenChange, tribe, members, currentUserId, onChanged }: Props) => {
  const { user } = useAuth();
  const moderation = useModeration();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(tribe.name);
  const [description, setDescription] = useState(tribe.description ?? "");
  // Owner-controlled. This used to be hardcoded 'private', which silently
  // flipped every public tribe to private on the first Manage save — killing
  // the non-member preview and share story that keys off visibility='public'.
  const [visibility, setVisibility] = useState<"public" | "private">(
    tribe.visibility === "private" ? "private" : "public",
  );
  const [activity, setActivity] = useState<string>(tribe.primary_activity ?? "");
  const [coverUrl, setCoverUrl] = useState(tribe.cover_url ?? "");
  const [coverPreview, setCoverPreview] = useState<string | null>(tribe.cover_url ?? null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  // Stored covers live in the private feed-images bucket — sign for preview.
  // Freshly picked files are data: URLs from FileReader and pass through as-is.
  const storedCoverSrc = useSignedMediaUrl(
    coverPreview && !coverPreview.startsWith("data:") ? coverPreview : null,
  );
  const displayCover = coverPreview?.startsWith("data:") ? coverPreview : storedCoverSrc;
  const [savingMeta, setSavingMeta] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  // The member pending a remove confirm. AlertDialog renders at --z-confirm
  // (140), above this sheet (120), so the real dialog can be used.
  const [confirmKick, setConfirmKick] = useState<Member | null>(null);

  useEffect(() => {
    if (open) {
      setName(tribe.name);
      setDescription(tribe.description ?? "");
      setVisibility(tribe.visibility === "private" ? "private" : "public");
      setActivity(tribe.primary_activity ?? "");
      setCoverUrl(tribe.cover_url ?? "");
      setCoverPreview(tribe.cover_url ?? null);
      setCoverFile(null);
      setConfirmKick(null);
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

      const { error } = await supabase.rpc("update_tribe", {
        p_tribe_id: tribeId,
        p_name: trimmed,
        p_description: description,
        p_visibility: visibility,
        p_cover_url: nextCoverUrl ?? undefined,
        p_clear_cover: willClear,
      });
      if (error) throw error;
      // Activity is a separate RPC (free-text column, own validation) —
      // best-effort so a hiccup here never rolls back the main save. It is
      // still a field the owner just typed, so a failure is named rather than
      // buried under "Tribe updated" with the old activity still on the card.
      let activityErr: unknown = null;
      if ((activity || null) !== (tribe.primary_activity ?? null)) {
        const { error: actErr } = await supabase.rpc("set_tribe_activity", {
          p_tribe: tribeId,
          // The server clears the activity on NULL; the generated arg type
          // (plain `string`) is stricter than the SQL signature actually is.
          p_activity: (activity || null) as string,
        });
        if (actErr) {
          console.warn("[tribe] set_tribe_activity failed", actErr);
          activityErr = actErr;
        }
      }
      if (activityErr) {
        toast("Tribe updated — except the activity.", {
          description: friendlyError(activityErr, "The activity kept its old value. Try that field again."),
          duration: 6000,
        });
      } else {
        toast.success("Tribe updated");
      }
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
      const { error } = await supabase.rpc("set_tribe_member_role", {
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
    setBusyId(userId);
    try {
      const { error } = await supabase.rpc("remove_tribe_member", {
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
    <BottomSheet
      open={open}
      onClose={() => onOpenChange(false)}
      label="Manage tribe"
      title="Manage tribe"
      subtitle="Details, cover photo, member roles."
      height="tall"
      bodyClassName="space-y-5 pt-2"
      footer={
        <Button onClick={handleSaveMeta} loading={busy} className="w-full" variant="ember" size="lg">
          {uploading ? "Uploading…" : "Save changes"}
        </Button>
      }
    >
      {/* Cover photo uploader */}
      <div>
        <p className={cn(LABEL, "mb-1.5")}>Cover photo</p>
        <div className="relative rounded-xl overflow-hidden border border-border bg-card/40 aspect-[16/9]">
          {coverPreview ? (
            <>
              {displayCover && <img loading="lazy" decoding="async" src={displayCover} alt="Cover preview" className="absolute inset-0 h-full w-full object-cover" />}
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
              <div className="absolute bottom-2 right-2 flex gap-1.5">
                <Button type="button" variant="secondary" size="sm" className="min-h-11 bg-[hsl(var(--background)/0.9)]" disabled={busy} onClick={() => fileRef.current?.click()}>
                  <Upload aria-hidden size={12} /> Change
                </Button>
                <Button type="button" variant="secondary" size="icon" className="bg-[hsl(var(--background)/0.9)] text-destructive" disabled={busy} onClick={handleRemoveCover} aria-label="Remove cover">
                  <Trash2 aria-hidden size={14} />
                </Button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-gold hover:bg-gold/5 transition-colors disabled:opacity-40"
            >
              <ImageIcon size={22} aria-hidden />
              <span className="text-[12px] font-bold">Add cover photo</span>
              <span className="text-[11px] text-muted-foreground/75">JPG, PNG, WEBP · max {MAX_COVER_SIZE_MB}MB</span>
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

      {/* Details */}
      <div className="space-y-3">
        <div>
          <label className={cn(LABEL, "mb-1.5 block")}>Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className="h-11" />
        </div>
        <div>
          <label className={cn(LABEL, "mb-1.5 block")}>Description</label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={280}
            rows={3}
            className="resize-none"
          />
        </div>
        <div>
          <label className={cn(LABEL, "mb-1.5 block")}>Activity</label>
          <select
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
            className="surface-inset w-full h-11 rounded-md px-3 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-gold/50"
          >
            <option value="">No activity set</option>
            {TRIBE_ACTIVITY_GROUPS.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.items.map((a) => (
                  <option key={a.name} value={a.name}>{a.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground mt-1">
            Shown on the browse list — how new members find you.
          </p>
        </div>
        <div>
          <p className={cn(LABEL, "mb-1.5")}>Privacy</p>
          <div className="grid grid-cols-2 gap-2">
            {([
              { v: "public" as const, icon: Globe, title: "Public", sub: "Anyone can preview & join" },
              { v: "private" as const, icon: Lock, title: "Private", sub: "Request to join · content hidden" },
            ]).map((opt) => {
              const active = visibility === opt.v;
              const OIcon = opt.icon;
              return (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setVisibility(opt.v)}
                  aria-pressed={active}
                  className={cn(
                    "press min-h-11 rounded-xl border p-3 text-left transition-colors",
                    active ? "border-gold/50 bg-gold/[0.07]" : "border-border/60 bg-card/40",
                  )}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <OIcon size={12} className={active ? "text-gold" : "text-muted-foreground"} aria-hidden />
                    <p className={cn("text-xs font-bold", active ? "text-gold" : "text-foreground/80")}>{opt.title}</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">{opt.sub}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Roles */}
      <div className="border-t border-border/35 pt-4">
        <div className="flex items-center justify-between mb-1">
          <h3 className={LABEL}>Members & roles</h3>
          <span className="text-[11px] text-muted-foreground tabular-nums">{adminCount}/2 admins</span>
        </div>

        {otherMembers.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3 text-center">No other members yet.</p>
        ) : (
          <div className="divide-y divide-border/35">
            {otherMembers.map((m) => {
              const isAdmin = m.role === "admin";
              const promoteDisabled = !isAdmin && adminCount >= 2;
              const rowBusy = busyId === m.user_id;
              return (
                <div key={m.user_id} className="flex items-center gap-2.5 py-2 min-h-[52px]">
                  <div className="h-8 w-8 rounded-full bg-secondary overflow-hidden shrink-0">
                    {m.avatar_url ? (
                      <img loading="lazy" decoding="async" src={avatarUrl(m.avatar_url, 48)} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-[11px] font-black text-muted-foreground">
                        {m.username.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{m.username}</p>
                    {isAdmin && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-gold">
                        <Crown size={10} aria-hidden /> Admin
                      </span>
                    )}
                  </div>
                  {isAdmin ? (
                    <Button size="sm" variant="ghost" loading={rowBusy} onClick={() => handleRoleChange(m.user_id, "member")}>
                      <ShieldOff aria-hidden size={12} /> Demote
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-gold hover:text-gold disabled:opacity-40"
                      disabled={promoteDisabled}
                      loading={rowBusy}
                      onClick={() => handleRoleChange(m.user_id, "admin")}
                      title={promoteDisabled ? "Max 2 admins reached" : "Promote to admin"}
                    >
                      <Shield aria-hidden size={12} /> Promote
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" aria-label={`Remove ${m.username}`} disabled={rowBusy} onClick={() => setConfirmKick(m)}>
                    <UserMinus aria-hidden size={12} />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmKick !== null}
        onOpenChange={(o) => { if (!o) setConfirmKick(null); }}
        title={confirmKick ? `Remove ${confirmKick.username}?` : "Remove member?"}
        description="They lose access to the tribe. They can be invited back later."
        actionLabel="Remove"
        onConfirm={() => {
          const m = confirmKick;
          setConfirmKick(null);
          if (m) void handleRemove(m.user_id, m.username);
        }}
      />
    </BottomSheet>
  );
};

export default TribeManageDialog;
