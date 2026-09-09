import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import TribeManageDialog from "@/components/TribeManageDialog";

// The kick path needs a second member in the tribe, which a QA account never
// has — so the confirm → RPC wiring has never been exercised by hand. Radix's
// AlertDialog renders in a portal above the sheet; if that ever regresses (a
// lost z-token, a swallowed onConfirm) the owner silently cannot remove anyone.

const rpc = vi.hoisted(() => vi.fn(async () => ({ error: null })));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "owner-1" } }) }));
vi.mock("@/hooks/use-moderation", () => ({ useModeration: () => ({ moderateImage: vi.fn() }) }));
vi.mock("@/lib/signed-url", () => ({ useSignedMediaUrl: () => null }));
vi.mock("@/lib/downscale-image", () => ({ downscaleImage: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const members = [
  { user_id: "owner-1", username: "owner", avatar_url: null, role: "owner" },
  { user_id: "u-alice", username: "alice", avatar_url: null, role: "member" },
  { user_id: "u-bob", username: "bob", avatar_url: null, role: "member" },
];

const renderDialog = () =>
  render(
    <TribeManageDialog
      tribeId="t-1"
      open
      onOpenChange={() => {}}
      tribe={{ name: "Iron Circle", description: null, visibility: "public", cover_url: null }}
      members={members}
      currentUserId="owner-1"
      onChanged={() => {}}
    />,
  );

describe("TribeManageDialog — removing a member", () => {
  beforeEach(() => rpc.mockClear());

  it("asks about the named member before calling remove_tribe_member", async () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Remove alice" }));

    const confirm = await screen.findByRole("alertdialog");
    expect(within(confirm).getByText("Remove alice?")).toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalled();

    fireEvent.click(within(confirm).getByRole("button", { name: "Remove" }));
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("remove_tribe_member", { p_tribe_id: "t-1", p_user_id: "u-alice" }),
    );
  });

  it("removes nobody when the confirm is cancelled", async () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Remove bob" }));
    const confirm = await screen.findByRole("alertdialog");
    fireEvent.click(within(confirm).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(rpc).not.toHaveBeenCalled();
  });
});
