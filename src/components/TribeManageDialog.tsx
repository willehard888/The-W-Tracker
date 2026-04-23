import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Crown, Loader2, Settings, Shield, ShieldOff, UserMinus, Globe, Lock } from "lucide-react";

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

const TribeManageDialog = ({ tribeId, open, onOpenChange, tribe, members, currentUserId, onChanged }: Props) => {
  const [name, setName] = useState(tribe.name);
  const [description, setDescription] = useState(tribe.description ?? "");
  // All tribes are private — visibility is locked, no setter needed.
  const visibility = "private" as const;
  const [coverUrl, setCoverUrl] = useState(tribe.cover_url ?? "");
  const [savingMeta, setSavingMeta] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(tribe.name);
      setDescription(tribe.description ?? "");
      // visibility is locked to "private" — no reset needed
      setCoverUrl(tribe.cover_url ?? "");
    }
  }, [open, tribe]);

  const otherMembers = members.filter((m) => m.user_id !== currentUserId && m.role !== "owner");
  const adminCount = otherMembers.filter((m) => m.role === "admin").length;

  const handleSaveMeta = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 3 || trimmed.length > 40) {
      toast.error("Name must be 3–40 characters");
      return;
    }
    setSavingMeta(true);
    try {
      const { error } = await supabase.rpc("update_tribe" as any, {
        p_tribe_id: tribeId,
        p_name: trimmed,
        p_description: description,
        p_visibility: visibility,
        p_cover_url: coverUrl.trim() || null,
        p_clear_cover: coverUrl.trim() === "",
      });
      if (error) throw error;
      toast.success("Tribe updated");
      onChanged();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update tribe");
    } finally {
      setSavingMeta(false);
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
      toast.error(e?.message ?? "Failed to update role");
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
      toast.error(e?.message ?? "Failed to remove member");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings size={16} className="text-gold" /> Manage tribe
          </DialogTitle>
          <DialogDescription>Edit tribe details and member roles. Max 2 admins.</DialogDescription>
        </DialogHeader>

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
            <Label className="text-xs">Cover image URL (optional)</Label>
            <Input
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              placeholder="https://…"
              className="mt-1"
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
          <Button onClick={handleSaveMeta} disabled={savingMeta} className="w-full" variant="coal">
            {savingMeta ? <Loader2 size={14} className="animate-spin" /> : null}
            Save changes
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
                        <img src={m.avatar_url} alt={m.username} className="h-full w-full object-cover" />
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
