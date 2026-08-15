// ─── Snippet embed rendering ──────────────────────────────────────────────
//
// Server-side rendering for embeddable snippets:
//   - text  → markdown rendered to HTML, then sanitized (blockquote)
//   - code  → shiki syntax highlighting (escaped by construction)
//   - math  → KaTeX server-side renderToString
//
// All output is safe to inject via `set:html` — every path either
// sanitizes user input (renderMarkdownText for text) or produces escaped
// markup (katex/shiki escape their input).  The escaping tests in
// snippetEmbed.test.ts guard this.

import katex from "katex";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import type { Highlighter } from "shiki";
import type { PublicSnippetResponse } from "./types";

export type EmbedTheme = "light" | "dark";

/** Escape a string for safe insertion into HTML text/attributes. */
export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Allowlist shared with the admin GUI renderer (web/src/lib/snippetRender.js):
// text-formatting quotation markup only — no script, iframe, object, img,
// or event-handler attributes.
const SNIPPET_ALLOWED_TAGS = [
  "p", "br", "strong", "em", "b", "i", "u", "s", "strike", "del", "ins",
  "a", "ul", "ol", "li", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6",
  "code", "pre", "span", "hr", "sub", "sup", "q", "mark", "small",
];

const SNIPPET_ALLOWED_ATTR: Record<string, string[]> = {
  a: ["href", "title", "rel", "target"],
};

/**
 * Render text-snippet markdown to sanitized HTML.
 *
 * Text snippets store raw markdown/HTML; render it server-side and
 * sanitize so nothing dangerous survives (scripts, event handlers,
 * javascript: URLs, images).
 */
export function renderMarkdownText(content: string): string {
  return sanitizeHtml(marked.parse(content), {
    allowedTags: SNIPPET_ALLOWED_TAGS,
    allowedAttributes: SNIPPET_ALLOWED_ATTR,
    allowedSchemes: ["http", "https", "mailto"],
  });
}

/**
 * Render KaTeX source to static HTML.
 *
 * Throws on parse errors so invalid math falls back to the escaped source
 * (never KaTeX's error-colored artifacts) — see the fallback wrapper in
 * renderSnippetContent.
 */
export function renderMath(source: string): string {
  return katex.renderToString(source, {
    throwOnError: true,
    displayMode: true,
    output: "html",
  });
}

// ─── Shiki highlighter (lazy singleton) ───────────────────────────────────

let highlighterPromise: Promise<Highlighter> | null = null;

const HIGHLIGHTER_LANGS = [
  "text",
  "python",
  "javascript",
  "typescript",
  "bash",
  "sql",
  "rust",
  "go",
  "c",
  "cpp",
  "java",
  "html",
  "css",
  "json",
  "yaml",
  "markdown",
  "latex",
];

function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = import("shiki").then(({ createHighlighter }) =>
      createHighlighter({
        themes: ["github-light", "github-dark"],
        langs: HIGHLIGHTER_LANGS,
      }),
    );
  }
  return highlighterPromise;
}

/** Highlight code server-side via shiki. Output is escaped by shiki. */
export async function highlightCode(
  code: string,
  language: string,
  theme: EmbedTheme = "light",
): Promise<string> {
  const highlighter = await getHighlighter();
  const lang = language || "text";
  try {
    return highlighter.codeToHtml(code, {
      lang,
      theme: theme === "dark" ? "github-dark" : "github-light",
    });
  } catch {
    // Unknown language — fall back to plain text rendering
    return `<pre class="snip-code-fallback"><code>${escapeHtml(code)}</code></pre>`;
  }
}

// ─── Content rendering ────────────────────────────────────────────────────

/**
 * Render a snippet's content to safe HTML, wrapped per content kind.
 *
 * text → `<blockquote class="snip-quote">…</blockquote>` (markdown
 * rendered then sanitized via `renderMarkdownText`)
 * code → shiki `<pre class="shiki">…</pre>` (or escaped fallback)
 * math → `<div class="snip-math">…</div>` (KaTeX)
 */
export async function renderSnippetContent(
  snippet: PublicSnippetResponse,
  theme: EmbedTheme = "light",
): Promise<string> {
  switch (snippet.content_kind) {
    case "code":
      return highlightCode(snippet.content, snippet.language, theme);
    case "math": {
      try {
        return `<div class="snip-math">${renderMath(snippet.content)}</div>`;
      } catch {
        return `<pre class="snip-math-fallback">${escapeHtml(snippet.content)}</pre>`;
      }
    }
    default:
      return `<blockquote class="snip-quote">${renderMarkdownText(snippet.content)}</blockquote>`;
  }
}

// ─── Attribution ──────────────────────────────────────────────────────────

export interface SnippetAttribution {
  /** Human-readable attribution text (source DOI + pages), already escaped. */
  text: string;
  /** Link to the source record's detail page, or null. */
  href: string | null;
}

/** Build the attribution footer for a snippet (source DOI + pages). */
export function snippetAttribution(snippet: PublicSnippetResponse): SnippetAttribution {
  const pages = [snippet.page_start, snippet.page_end].filter(Boolean).join("-");
  let text = "";
  let href: string | null = null;
  if (snippet.source_doi) {
    const suffix = snippet.source_doi.replace(/^10\.ronzz\//, "");
    href = `/doi/${encodeURIComponent(suffix)}`;
    text = `Source: ${escapeHtml(snippet.source_doi)}`;
    if (pages) text += `, ${escapeHtml(pages)}`;
  } else if (pages) {
    text = `Pages: ${escapeHtml(pages)}`;
  }
  return { text, href };
}

// ─── Embed tag generation (mirrors the CLI `snippet embed` output) ────────

const DEFAULT_EMBED_BASE = "https://doi.ronzz.org/embed";

export interface EmbedTagOptions {
  base?: string;
  width?: number;
  height?: number;
  title?: string;
  doi: string;
}

/** Generate a copy-paste `<iframe>` embed tag for a snippet DOI. */
export function embedIframeTag(options: EmbedTagOptions): string {
  const base = (options.base || DEFAULT_EMBED_BASE).replace(/\/+$/, "");
  const doi = options.doi;
  const title = escapeHtml(options.title || `Snippet: ${doi}`);
  return (
    `<iframe src="${base}/${doi}" title="${title}" ` +
    `width="${options.width ?? 640}" height="${options.height ?? 240}" ` +
    `loading="lazy" style="border:0;border-radius:8px" ` +
    `referrerpolicy="no-referrer" allowfullscreen></iframe>`
  );
}

/** Build the embed URL for a snippet DOI. */
export function embedUrl(doi: string, base?: string): string {
  return `${(base || DEFAULT_EMBED_BASE).replace(/\/+$/, "")}/${doi}`;
}
