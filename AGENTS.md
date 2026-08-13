# AGENTS.md — ronzzdoi-public-web

Canonical instruction file for AI agents working on the **ronzzdoi-public-web**
repo — the public-facing web frontend for [ronzzdoi](https://github.com/Ron-RONZZ-org/ronzzdoi).

## Summary

Astro 5 (SSR, `@astrojs/node` standalone) + Svelte 5 islands + Tailwind 4 app
serving `doi.ronzz.org`: DOI browse/search/cite pages and server-rendered
**snippet embed fragments** (`/embed/10.ronzz/<suffix>`) for iframing on other
ronzz sites. It is the **read/UI layer only** — all data comes from the ronzzdoi
public API (`API_BASE_URL`); writes happen on `doi-admin.ronzz.org` via the
ronzzdoi CLI/GUI.

## Purpose and Expected Behavior

- `src/pages/doi/[suffix].astro` — DOI detail page; dispatches by `doi_type`
  to PersonView / CountryView / EntityView / QuotationView (snippets) /
  ExternalRedirectView / CitationView / UnresolvedView. Snippet DOIs are NOT
  citable — skip the citation fetch for them.
- `src/pages/embed/[...doi].astro` — self-contained iframe fragment for
  snippets. No site chrome, **no scripts** (`CSP: default-src 'none'`).
  Query options: `?theme=dark`, `?cite=0`, `?title=`.
- `src/lib/snippetEmbed.ts` — shared server-side rendering (used by both the
  detail page and the embed page): text → escaped `blockquote`, code → shiki,
  math → KaTeX `renderToString` with escaped fallback.

## Constraints and Invariants

- **XSS safety is non-negotiable.** Snippet content is user-authored and gets
  injected into third-party pages. Every content path must escape:
  `escapeHtml` for text, shiki/katex for code/math (they escape by
  construction). Never interpolate raw metadata into HTML.
- **`{#if}` / `{#each}` do not exist in Astro** — that is Svelte syntax. Use
  `{cond ? <A/> : <B/>}` / `{cond && <A/>}` and `.map()`. See `[suffix].astro`
  and `CitationView.astro` for the established pattern.
- **No nested-brace template literals inside Astro expressions.**
  `href={`/x/${foo ?? ""}`}` inside `{...}` breaks the Astro parser — precompute
  strings in the frontmatter.
- **Embed pages must stay script-free** — keep `default-src 'none'` in the
  embed CSP; do not add client JS to the embed fragment.
- **Headers on `/embed/`**: `Cross-Origin-Resource-Policy: cross-origin`,
  `Cache-Control: public, max-age=60, s-maxage=300` (edits propagate ≤5 min).
  Framing policy is `CSP frame-ancestors *` (nginx `/embed/` location) — never
  re-add `X-Frame-Options: DENY` for embed paths.
- `API_BASE_URL` is read from `process.env` at **runtime** (server-side) — the
  deployed `.env`/systemd unit sets it to `http://127.0.0.1:8012`.

## Input/Output Expectations

- API responses typed in `src/lib/types.ts` (`PublicDOIResponse`,
  `PublicSnippetResponse`, …). `fetchSnippet(doi)` hits
  `/public/v1/snippet/{doi}` — 410 for tombstoned, 404 for non-snippets.
- Errors map to `src/lib/errors.ts` (`ApiError`, `GoneError`, `NotFoundError`,
  `RateLimitedError`) and render via `ErrorState.astro` / status pages.

## Documentation Reference

- ronzzdoi root `AGENTS.md` → Deployment, nginx + DNS, module docs.
- `docs/AGENTS-snippet.md` (ronzzdoi repo) → embed rendering contract.
- This repo's `README.md` → features, quick start, deployment, related endpoints.

## Domain-Specific Rules for Agents

- **Modify `src/lib/snippetEmbed.ts` only through its tests** — every new
  rendering path needs a case in `src/lib/snippetEmbed.test.ts` proving
  escaping (an XSS payload must never survive).
- **Extend tests when you touch rendering**: `npx vitest run` for unit tests
  (include: `src/**/*.test.ts`), `tests/e2e_smoke.mjs` for the browser smoke
  (needs a running backend + `CHROME_PATH`).
- **Astro build must pass** before committing UI changes: `npm run build`
  (catches template syntax errors like the ones above).
- **Keep the detail page and embed page rendering in sync** — both call
  `renderSnippetContent()`; don't fork the HTML.
- **nginx conf lives in `deploy/ronzzdoi-web.nginx.conf`** (reference) and is
  applied manually on the server — after changing embed headers, update the
  repo conf AND note that the server conf must be re-applied + `nginx -t` +
  reload.
- **Do not add heavy client dependencies** — rendering is server-side by
  design; keep the embed fragment free of JS.
