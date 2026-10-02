import "@/test/route-mocks";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { setMode } from "@/test/supabase-stub";
import { mountRoute } from "@/test/mount-route";
import Coach from "@/pages/Coach";

/**
 * The chat sheet after Batch B: a question arrives as a tap (here through
 * `?ask=` from the review), the reply's @@FOLLOWUPS trailer never shows and
 * becomes the chips under the bubble, and the composer is folded behind one
 * link until the member asks for it.
 */
const sse = (text: string) => {
  const enc = new TextEncoder();
  const chunks = text.match(/[\s\S]{1,7}/g) ?? [];
  return new ReadableStream<Uint8Array>({
    start(c) {
      for (const ch of chunks) c.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: ch } }] })}\n\n`));
      c.enqueue(enc.encode("data: [DONE]\n\n"));
      c.close();
    },
  });
};

const REPLY = "Hold **100 kg** on Thursday — finish the range first.\n\n@@FOLLOWUPS\n- Should I add 2.5 kg after that?\n- Why was my HRV down on Tuesday?";

describe("coach chat — questions first, composer second", () => {
  const bodies: Array<Record<string, unknown>> = [];
  beforeEach(() => {
    setMode("empty");
    // jsdom has no Element.scrollTo; the thread follows the stream with it.
    Element.prototype.scrollTo = Element.prototype.scrollTo ?? (() => {});
    bodies.length = 0;
    try { localStorage.setItem("w_coach_onboard_skipped", "1"); localStorage.removeItem("w_coach_messages_v1"); } catch {}
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("/functions/v1/ai-coach")) {
        bodies.push(JSON.parse(String(init?.body)));
        return new Response(sse(REPLY), { status: 200, headers: { "Content-Type": "text/event-stream" } });
      }
      return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); cleanup(); });

  it("sends a tapped question with its source, hides the trailer, shows its questions as chips, and keeps the composer folded", async () => {
    mountRoute("/coach", `/coach?ask=${encodeURIComponent("How am I doing?")}&src=review`, Coach);

    // The reply, with the trailer gone and the chips in its place.
    const bubble = await screen.findByText(/finish the range first/i, {}, { timeout: 4000 });
    expect(bubble).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Ask next")).toBeInTheDocument());
    expect(document.body.textContent).not.toContain("@@FOLLOWUPS");
    const chips = within(screen.getByLabelText("Ask next")).getAllByRole("button");
    expect(chips.map((c) => c.textContent)).toEqual(["Should I add 2.5 kg after that?", "Why was my HRV down on Tuesday?"]);

    // The request carried where the question came from and the sent history.
    expect(bodies[0]).toMatchObject({ source: "review" });
    expect((bodies[0].messages as Array<{ content: string }>).at(-1)?.content).toBe("How am I doing?");

    // Composer folded; one link opens it.
    expect(screen.queryByPlaceholderText("Ask your coach…")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Type your own question" }));
    expect(await screen.findByPlaceholderText("Ask your coach…")).toBeInTheDocument();

    // A chip is the next question — sent as a follow-up.
    fireEvent.click(chips[0]);
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[1]).toMatchObject({ source: "followup" });
    // The stored assistant turn goes up without its trailer.
    const prior = (bodies[1].messages as Array<{ role: string; content: string }>).find((m) => m.role === "assistant");
    expect(prior?.content).not.toContain("@@FOLLOWUPS");
  });
});
