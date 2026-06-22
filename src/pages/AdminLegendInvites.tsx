import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, Loader2, Copy, CheckCircle2, Clock, Sparkles, Mail } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import EmptyState from "@/components/ui/empty-state";

type LegendInvite = {
  id: string;
  code: string;
  created_by: string;
  used_by: string | null;
  used_at: string | null;
  expires_at: string | null;
  note: string | null;
  created_at: string;
};

export default function AdminLegendInvites() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [expiresInDays, setExpiresInDays] = useState<string>("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    supabase
      .rpc("has_role", { _user_id: user.id, _role: "admin" })
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  const { data: invites, isLoading } = useQuery({
    queryKey: ["legend-invites"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legend_invites")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as LegendInvite[];
    },
  });

  if (isAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/" replace />;

  const createInvite = async () => {
    setCreating(true);
    try {
      const expires_at = expiresInDays
        ? new Date(Date.now() + Number(expiresInDays) * 86400000).toISOString()
        : null;
      const { data, error } = await supabase.rpc("create_legend_invite", {
        p_code: code.trim() || null,
        p_expires_at: expires_at,
        p_note: note.trim() || null,
      });
      if (error) throw error;
      const result = data as any;
      if (!result?.success) {
        toast.error(`Failed: ${result?.reason ?? "unknown"}`);
        return;
      }
      toast.success(`Code ${result.code} created`);
      setCode("");
      setNote("");
      setExpiresInDays("");
      queryClient.invalidateQueries({ queryKey: ["legend-invites"] });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to create invite");
    } finally {
      setCreating(false);
    }
  };

  const copyCode = (c: string) => {
    navigator.clipboard.writeText(c);
    toast.success("Code copied");
  };

  return (
    <div className="min-h-screen pb-12 px-4 pt-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Crown className="h-5 w-5 text-gold" fill="currentColor" />
          <h1 className="font-display text-2xl font-bold tracking-tight">Legend Invites</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Invite-only access to the Legend tier. Each code is single-use.
        </p>
      </div>

      <div className="rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/10 via-card to-card p-4 mb-6 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-gold" />
          <h2 className="text-sm font-bold uppercase tracking-wider">Create new invite</h2>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Custom code (optional, auto-generated if empty)</Label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="LEGEND-2026"
            maxLength={40}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label className="text-xs">Expires in (days)</Label>
            <Input
              type="number"
              min="1"
              max="365"
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value)}
              placeholder="never"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Note</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="for @username"
              maxLength={120}
            />
          </div>
        </div>
        <Button
          onClick={createInvite}
          disabled={creating}
          className="w-full bg-gradient-to-r from-gold via-amber-500 to-gold text-background font-bold"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
          Generate Legend invite
        </Button>
      </div>

      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
        All invites ({invites?.length ?? 0})
      </h3>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gold" />
        </div>
      )}

      <div className="space-y-2">
        {invites?.map((inv) => {
          const isUsed = !!inv.used_by;
          const isExpired = inv.expires_at && new Date(inv.expires_at) < new Date();
          return (
            <div
              key={inv.id}
              className={`rounded-xl border p-3 ${
                isUsed
                  ? "border-border/40 bg-secondary/30 opacity-60"
                  : isExpired
                    ? "border-destructive/30 bg-card opacity-70"
                    : "border-gold/30 bg-card"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="font-mono text-sm font-bold text-gold tracking-wider">
                      {inv.code}
                    </code>
                    {isUsed && (
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground inline-flex items-center gap-1">
                        <CheckCircle2 size={10} /> Redeemed
                      </span>
                    )}
                    {!isUsed && isExpired && (
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-destructive/20 text-destructive">
                        Expired
                      </span>
                    )}
                    {!isUsed && !isExpired && (
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-gold/20 text-gold">
                        Active
                      </span>
                    )}
                  </div>
                  {inv.note && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">{inv.note}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1 inline-flex items-center gap-1">
                    <Clock size={10} />
                    Created {formatDistanceToNow(new Date(inv.created_at), { addSuffix: true })}
                    {inv.expires_at && ` · expires ${formatDistanceToNow(new Date(inv.expires_at), { addSuffix: true })}`}
                    {inv.used_at && ` · redeemed ${formatDistanceToNow(new Date(inv.used_at), { addSuffix: true })}`}
                  </p>
                </div>
                {!isUsed && !isExpired && (
                  <Button size="sm" variant="outline" onClick={() => copyCode(inv.code)}>
                    <Copy size={14} />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
        {!isLoading && invites && invites.length === 0 && (
          <EmptyState size="compact" icon={Mail} title="No invites yet" />
        )}
      </div>
    </div>
  );
}
