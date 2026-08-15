import { describe, it, expect } from "vitest";
import {
  escapeHtml,
  renderMath,
  highlightCode,
  renderMarkdownText,
  renderSnippetContent,
  snippetAttribution,
  embedIframeTag,
  embedUrl,
} from "./snippetEmbed";
import type { PublicSnippetResponse } from "./types";

function snippet(overrides: Partial<PublicSnippetResponse> = {}): PublicSnippetResponse {
  return {
    doi: "10.ronzz/abc123",
    title: "Test Snippet",
    content_kind: "text",
    content: "hello world",
    language: "",
    source_doi: null,
    page_start: "",
    page_end: "",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

// ─── escapeHtml ──────────────────────────────────────────────────────────

describe("escapeHtml", () => {
  it("escapes HTML metacharacters", () => {
    expect(escapeHtml(`<script>alert("x")</script> & '`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;",
    );
  });

  it("leaves plain text untouched", () => {
    expect(escapeHtml("To be or not to be")).toBe("To be or not to be");
  });
});

// ─── renderMath (KaTeX) ──────────────────────────────────────────────────

describe("renderMath", () => {
  it("renders KaTeX source to HTML", () => {
    const html = renderMath(String.raw`\frac{a}{b}`);
    expect(html).toContain("katex");
  });

  it("throws on invalid source (fallback handled by renderSnippetContent)", () => {
    expect(() => renderMath(String.raw`\undefinedcommand{`)).toThrow();
  });

  it("falls back to escaped source for invalid math", async () => {
    const html = await renderSnippetContent(
      snippet({ content_kind: "math", content: String.raw`\undefinedcommand{` }),
    );
    expect(html).toContain("math-fallback");
    expect(html).not.toContain("<script>");
  });
});

// ─── highlightCode (shiki) ───────────────────────────────────────────────

describe("highlightCode", () => {
  it("highlights python code", async () => {
    const html = await highlightCode("print('hi')", "python");
    expect(html).toContain("<pre");
    expect(html).toContain("shiki");
  });

  it("escapes embedded HTML in code", async () => {
    const html = await highlightCode(`<script>alert(1)</script>`, "text");
    expect(html).not.toContain("<script>");
    // shiki escapes `<` as &#x3C; — the point is no raw HTML survives
    expect(html).toContain("&#x3C;");
    expect(html).not.toMatch(/<script>/);
  });

  it("falls back to plain text for unknown languages", async () => {
    const html = await highlightCode("x = 1", "definitely-not-a-language");
    expect(html).toContain("snip-code-fallback");
    expect(html).not.toContain("<script>");
  });

  it("renders dark theme", async () => {
    const html = await highlightCode("print(1)", "python", "dark");
    expect(html).toContain("github-dark");
  });
});

// ─── renderMarkdownText ───────────────────────────────────────────────────

describe("renderMarkdownText", () => {
  it("renders markdown emphasis, links and code spans", () => {
    const html = renderMarkdownText("**bold** and `code` — see [the book](https://x)");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<code>code</code>");
    expect(html).toContain('<a href="https://x">the book</a>');
  });

  it("renders headings and lists", () => {
    const html = renderMarkdownText("# Act III\n\n- a\n- b");
    expect(html).toContain("<h1>Act III</h1>");
    expect(html).toContain("<li>a</li>");
  });

  it("never lets a script payload survive", () => {
    const html = renderMarkdownText('a<script>alert(1)</script>b');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("alert(1)");
  });

  it("strips event handlers, javascript: URLs and images", () => {
    const html = renderMarkdownText(
      '<img src="x" onerror="alert(1)"> <a href="javascript:alert(1)">click</a>',
    );
    expect(html).not.toContain("<img");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("javascript:");
  });

  it("keeps sanitized pasted HTML markup", () => {
    const html = renderMarkdownText("<p>A <b>wise</b> quote</p>");
    expect(html).toContain("<p>A <b>wise</b> quote</p>");
  });

  it("keeps text inside disallowed formatting tags", () => {
    const html = renderMarkdownText("<center>keep me</center>");
    expect(html).toContain("keep me");
  });
});

// ─── renderSnippetContent ────────────────────────────────────────────────

describe("renderSnippetContent", () => {
  it("wraps text in a blockquote with rendered, sanitized markdown", async () => {
    const html = await renderSnippetContent(snippet({ content: `"quote" <b>bold</b>` }));
    expect(html).toContain('<blockquote class="snip-quote">');
    expect(html).toContain("<b>bold</b>");
  });

  it("escapes plain text inside the blockquote", async () => {
    const html = await renderSnippetContent(snippet({ content: "<script>alert(1)</script>" }));
    expect(html).not.toContain("<script");
    expect(html).not.toContain("alert(1)");
  });

  it("renders code via shiki", async () => {
    const html = await renderSnippetContent(
      snippet({ content_kind: "code", content: "print(1)", language: "python" }),
    );
    expect(html).toContain("shiki");
  });

  it("renders math via KaTeX", async () => {
    const html = await renderSnippetContent(
      snippet({ content_kind: "math", content: String.raw`e^{i\pi}` }),
    );
    expect(html).toContain("katex");
  });
});

// ─── snippetAttribution ──────────────────────────────────────────────────

describe("snippetAttribution", () => {
  it("returns empty for unattributed snippets", () => {
    expect(snippetAttribution(snippet())).toEqual({ text: "", href: null });
  });

  it("builds source link + pages", () => {
    const attr = snippetAttribution(
      snippet({ source_doi: "10.ronzz/book1", page_start: "12", page_end: "14" }),
    );
    expect(attr.href).toBe("/doi/book1");
    expect(attr.text).toContain("10.ronzz/book1");
    expect(attr.text).toContain("12-14");
  });

  it("escapes source DOI in text", () => {
    const attr = snippetAttribution(snippet({ source_doi: '10.ronzz/<book>"' }));
    expect(attr.text).not.toContain("<book>");
    expect(attr.text).toContain("&lt;book&gt;");
  });

  it("shows pages without a source", () => {
    const attr = snippetAttribution(snippet({ page_start: "3" }));
    expect(attr.text).toBe("Pages: 3");
    expect(attr.href).toBeNull();
  });
});

// ─── embedIframeTag / embedUrl ───────────────────────────────────────────

describe("embedIframeTag", () => {
  it("builds an iframe pointing at the embed page", () => {
    const tag = embedIframeTag({ doi: "10.ronzz/abc123", title: "Test Snippet" });
    expect(tag).toContain('<iframe src="https://doi.ronzz.org/embed/10.ronzz/abc123"');
    expect(tag).toContain('title="Test Snippet"');
    expect(tag).toContain('width="640"');
    expect(tag).toContain('loading="lazy"');
  });

  it("uses the given title and escapes it", () => {
    const tag = embedIframeTag({ doi: "10.ronzz/abc", title: 'Q "x" <y>' });
    expect(tag).toContain("&quot;x&quot;");
    expect(tag).not.toContain("<y>");
  });

  it("honours custom base and size", () => {
    const tag = embedIframeTag({ doi: "10.ronzz/abc", base: "http://localhost:4321/embed/", width: 800, height: 300 });
    expect(tag).toContain('src="http://localhost:4321/embed/10.ronzz/abc"');
    expect(tag).toContain('width="800" height="300"');
  });
});

describe("embedUrl", () => {
  it("normalizes the base trailing slash", () => {
    expect(embedUrl("10.ronzz/abc", "https://doi.ronzz.org/embed/")).toBe(
      "https://doi.ronzz.org/embed/10.ronzz/abc",
    );
  });

  it("defaults to the production base", () => {
    expect(embedUrl("10.ronzz/abc")).toBe("https://doi.ronzz.org/embed/10.ronzz/abc");
  });
});
