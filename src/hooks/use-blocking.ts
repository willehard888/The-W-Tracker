import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { hapticNotification } from "@/lib/haptics";

/**
 * Block-user + report-content (App Store 1.2 safety). Blocking is one-way; the
 * server hides content in both directions via RLS (is_blocked), so after a
 * block we just refresh the content queries and the blocked user's posts,
 * comments, DMs and friendship drop out on the next fetch.
 */

export type ReportContentType =
  | "feed_post" | "tribe_post" | "comment" | "tribe_comment" | "direct_message" | "profile";

export function useBlockActions() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const refreshAfterBlockChange = useCallback(() => {
    // Content visibility is server-enforced; just refetch what shows other
    // users' content so the blocked/unblocked rows appear or disappear.
    ["blocked-users", "feed-posts", "feed-comments", "conversations",
     "friends", "pending-friend-requests", "tribe-posts"].forEach((k) =>
      qc.invalidateQueries({ queryKey: [k] }),
    );
  }, [qc]);

  const block = useCallback(async (targetId: string, username?: string) => {
    if (!user || targetId === user.id) return;
    const { error } = await supabase.rpc("block_user" as never, { p_target: targetId } as never);
    if (error) { toast.error("Couldn't block — try again."); return; }
    hapticNotification("success");
    toast.success(username ? `@${username} blocked` : "User blocked", {
      description: "They can't message or friend you, and you won't see each other's content.",
    });
    refreshAfterBlockChange();
  }, [user, refreshAfterBlockChange]);

  const unblock = useCallback(async (targetId: string, username?: string) => {
    const { error } = await supabase.rpc("unblock_user" as never, { p_target: targetId } as never);
    if (error) { toast.error("Couldn't unblock — try again."); return; }
    toast.success(username ? `@${username} unblocked` : "User unblocked");
    refreshAfterBlockChange();
  }, [refreshAfterBlockChange]);

  const report = useCallback(async (
    contentType: ReportContentType,
    contentId: string,
    reportedUserId: string,
    reason = "Reported by user",
  ) => {
    const { error } = await supabase.rpc("report_content" as never, {
      p_content_type: contentType,
      p_content_id: contentId,
      p_reported_user: reportedUserId,
      p_reason: reason,
    } as never);
    if (error) { toast.error("Couldn't send report — try again."); return; }
    hapticNotification("success");
    toast.success("Report sent", { description: "Our team reviews reports — usually within 24 hours." });
  }, []);

  return { block, unblock, report };
}
