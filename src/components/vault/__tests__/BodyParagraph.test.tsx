import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import { BodyParagraph } from "../VaultArticleSheet";

const html = (md: string) => renderToStaticMarkup(<ReactMarkdown components={{ p: BodyParagraph }}>{md}</ReactMarkdown>);

describe("Vault body: a paragraph's opening bold line is its heading", () => {
  it("lifts the bold line into a heading and keeps the paragraph", () => {
    const out = html("**The dose**\nSeven to nine hours.\n\n**The room**\nDark and cool.");
    expect(out.match(/<h4/g)?.length).toBe(2);
    expect(out).toContain(">The dose</h4>");
    expect(out).toContain("<p>Seven to nine hours.</p>");
  });

  it("a heading straight above a list stands alone", () => {
    const out = html("**The routine**\n1. Hip flexor stretch.\n2. Cat and cow.");
    expect(out).toContain(">The routine</h4>");
    expect(out).toContain("<ol>");
    expect(out).not.toContain("<p></p>");
  });

  it("a bold term inside a sentence stays inline, and authored newlines survive", () => {
    const out = html("The term **anabolic resistance** matters.\n\nSettle. Three breaths.\nRelease. Let it go.");
    expect(out).not.toContain("<h4");
    expect(out).toContain("<strong>anabolic resistance</strong>");
    expect(out).toContain("Settle. Three breaths.\nRelease. Let it go.");
  });
});
