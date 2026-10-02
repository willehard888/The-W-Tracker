import { describe, it, expect } from "vitest";
import { splitFollowups, visibleWhileStreaming } from "../coach-followups";

const reply = "Hold 100 kg on Thursday — finish the range first.\n\n@@FOLLOWUPS\n- Should I add 2.5 kg to the squat after that?\n- Why was my HRV down after Tuesday's session?\n- What does 9 000 steps do for recovery?\n- a fourth one that is dropped";

describe("splitFollowups", () => {
  it("returns the body without the trailer and at most three questions", () => {
    const { body, questions } = splitFollowups(reply);
    expect(body).toBe("Hold 100 kg on Thursday — finish the range first.");
    expect(questions).toEqual([
      "Should I add 2.5 kg to the squat after that?",
      "Why was my HRV down after Tuesday's session?",
      "What does 9 000 steps do for recovery?",
    ]);
  });

  it("tolerates a marker wrapped in markdown, numbered lines and a long question", () => {
    const { body, questions } = splitFollowups(`Moi.\n\n**@@FOLLOWUPS**\n1. ${"x".repeat(90)}\n2) \`Second one?\``);
    expect(body).toBe("Moi.");
    expect(questions[0]).toHaveLength(72);
    expect(questions[1]).toBe("Second one?");
  });

  it("leaves a reply without a trailer alone", () => {
    expect(splitFollowups("Just a line.")).toEqual({ body: "Just a line.", questions: [] });
  });
});

describe("visibleWhileStreaming", () => {
  it("hides the trailer and a half-arrived marker, never ordinary text", () => {
    expect(visibleWhileStreaming(reply)).toBe("Hold 100 kg on Thursday — finish the range first.");
    expect(visibleWhileStreaming("Finish the range.\n\n@@FOL")).toBe("Finish the range.\n");
    expect(visibleWhileStreaming("Finish the range.\n@")).toBe("Finish the range.");
    expect(visibleWhileStreaming("Email me at coach@")).toBe("Email me at coach");
    expect(visibleWhileStreaming("Finish the range at RPE 8.")).toBe("Finish the range at RPE 8.");
  });
});
