import { describe, expect, it } from "vitest";
import { rankMarks } from "@/lib/leaderboard-query";

const labels = (scores: number[]) =>
  rankMarks(scores).map((m) => (m.tied ? `=${m.position}` : `${m.position}`));

describe("rankMarks", () => {
  it("numbers a board with no ties 1..n", () => {
    expect(labels([533, 355, 40, 25])).toEqual(["1", "2", "3", "4"]);
  });

  it("shares the position of a tie block and skips the numbers it consumed", () => {
    // The live September board: mogger88 and wtest0901 both hold 40 season XP,
    // and a UUID used to decide which of them got the third podium card.
    expect(labels([533, 355, 40, 40, 25])).toEqual(["1", "2", "=3", "=3", "5"]);
  });

  it("handles a three-way tie", () => {
    expect(labels([100, 40, 40, 40, 10])).toEqual(["1", "=2", "=2", "=2", "5"]);
  });

  it("handles a tie for first", () => {
    expect(labels([40, 40, 25])).toEqual(["=1", "=1", "3"]);
  });

  it("handles a tie at the very end", () => {
    expect(labels([100, 40, 40])).toEqual(["1", "=2", "=2"]);
  });

  it("treats a whole board of equals as one block", () => {
    expect(labels([40, 40, 40])).toEqual(["=1", "=1", "=1"]);
  });

  it("returns nothing for an empty board", () => {
    expect(rankMarks([])).toEqual([]);
  });

  it("does not mark a lone row as tied", () => {
    expect(rankMarks([7])).toEqual([{ position: 1, tied: false }]);
  });
});
