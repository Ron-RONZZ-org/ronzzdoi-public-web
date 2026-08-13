/**
 * E2E Smoke Test — ronzzdoi-public-web
 *
 * Verifies browser DOM rendering for the public-facing website:
 *   - Home page renders with search bar
 *   - Search page handles empty/no-results/error states
 *   - Error pages (404, 429, 500) render correctly
 *   - DOI detail page shows error state when backend is unavailable
 *   - No unhandled JS exceptions
 *
 * Usage:
 *   FRONTEND_URL=http://127.0.0.1:4321 node tests/e2e_smoke.mjs
 */

import { chromium } from "playwright";
import { strict as assert } from "assert";

// ── Config ────────────────────────────────────────────────────────────────

const FRONTEND_URL = process.env.FRONTEND_URL || "http://127.0.0.1:4321";
const CHROME_PATH = process.env.CHROME_PATH || "chromium";

// ── Shared state ──────────────────────────────────────────────────────────

let browser = null;
let page = null;
let pageErrors = [];
let consoleErrors = [];
let passed = 0;
let failed = 0;

// ── Utilities ─────────────────────────────────────────────────────────────

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function test(desc, fn) {
  try {
    await fn();
    console.log(`  \u2713 ${desc}`);
    passed++;
  } catch (e) {
    try {
      await page.screenshot({ path: `/tmp/e2e-ronzzdoi-public-web-fail-${Date.now()}.png` });
    } catch {}
    try {
      const bodyText = (await page.locator("body").textContent() || "").substring(0, 300);
      console.log(`    Page text: "${bodyText.replace(/\s+/g, " ").trim()}"`);
    } catch {}
    console.log(`  \u2717 ${desc}: ${e.message}`);
    failed++;
  }
}

async function getPageText() {
  return (await page.locator("body").textContent() || "").replace(/\s+/g, " ").trim();
}

// ── Browser lifecycle ────────────────────────────────────────────────────

async function navigate(path) {
  await page.goto(`${FRONTEND_URL}${path}`, { waitUntil: "networkidle", timeout: 15000 });
  await sleep(300);
}

async function runTests() {
  console.log("\n--- HOME PAGE ---");

  await test("Home page loads and shows branding", async () => {
    await navigate("/");
    const text = await getPageText();
    assert(text.includes("ronzzdoi"), "Page title should contain 'ronzzdoi'");
  });

  await test("Home page has a search input", async () => {
    const input = page.locator('input[name="q"]');
    await input.waitFor({ state: "visible", timeout: 3000 });
    assert(await input.isVisible(), "Search input should be visible");
  });

  await test("Home page has a search submit button", async () => {
    const btn = page.locator('button[type="submit"]');
    assert(await btn.isVisible(), "Search button should be visible");
  });

  await test("Home page search form has type filter dropdown", async () => {
    const select = page.locator('select[name="doi_type"]');
    assert(await select.isVisible(), "DOI type filter should be visible");
    const options = await select.locator("option").count();
    assert(options >= 5, `Expected ≥5 type options, got ${options}`);
  });

  await test("Home page has Exact words / Fuzzy match mode toggle", async () => {
    const modeGroup = page.locator('[role="radiogroup"][aria-label="Search mode"]');
    await modeGroup.waitFor({ state: "visible", timeout: 3000 });
    const buttons = await modeGroup.locator('button[role="radio"]').allTextContents();
    assert(buttons.some((b) => b.includes("Exact")), "Should have 'Exact words' button");
    assert(buttons.some((b) => b.includes("Fuzzy")), "Should have 'Fuzzy match' button");
  });

  await test("Home page has 'Browse all records' link", async () => {
    const link = page.locator('a[href*="/search"]');
    await link.first().waitFor({ state: "visible", timeout: 3000 });
    const href = await link.first().getAttribute("href");
    assert(href.includes("/search"), `Link should go to search, got ${href}`);
  });

  await test("Home page footer is present", async () => {
    const footer = page.locator("footer");
    assert(await footer.isVisible(), "Footer should be visible");
    const text = await footer.textContent();
    assert(text.includes("ronzz.org"), "Footer should mention ronzz.org");
  });

  console.log("\n--- SEARCH PAGE ---");

  await test("Search page with empty query shows prompt", async () => {
    await navigate("/search?q=");
    const text = await getPageText();
    assert(text.includes("Enter a search term"), "Should show 'Enter a search term' prompt");
  });

  await test("Search page with no-results query shows 'No results' state", async () => {
    // This will hit the API which may fail — verify error OR no-results is handled
    await navigate("/search?q=ZZZZNONEXISTENT");
    const text = await getPageText();
    const isError = text.includes("Error") || text.includes("500");
    const isNoResults = text.includes("No results") || text.includes("no results");
    // Either error (no backend) or no-results (backend returns empty) is acceptable
    assert(isError || isNoResults, "Should show either error or no-results state");
  });

  await test("Search page has search form visible", async () => {
    await navigate("/search?q=");
    const input = page.locator('input[name="q"]');
    await input.waitFor({ state: "visible", timeout: 3000 });
    assert(await input.isVisible(), "Search input should be present on search page");
  });

  console.log("\n--- DOI DETAIL PAGE ---");

  await test("DOI detail page renders error state when backend unavailable", async () => {
    await navigate("/doi/abc123");
    const text = await getPageText();
    // Should show breadcrumb navigation
    assert(text.includes("Home") || text.includes("Search"), "Should show breadcrumb");
    // Either the error state or some DOI content
    const hasError = text.includes("Error") || text.includes("Not Found") || text.includes("500");
    const hasContent = text.includes("10.ronzz") || text.includes("DOI");
    assert(hasError || hasContent, "Should show either error or content");
  });

  await test("DOI detail page shows breadcrumb", async () => {
    await navigate("/doi/test-suffix");
    const nav = page.locator('nav[aria-label="Breadcrumb"]');
    assert(await nav.isVisible().catch(() => false), "Breadcrumb nav should be present");
  });

  console.log("\n--- DOI RESOLUTION (issue #40) ---");

  await test("Canonical DOI URL redirects to a detail or error page, never crashes", async () => {
    // doi.ronzz.org/10.ronzz/<suffix> must resolve: external DOIs 302 to
    // their target, other DOIs redirect to /doi/<suffix>, missing DOIs to
    // /404. Without a live backend an error page is acceptable — the key
    // invariant is that the redirect chain terminates on a real page.
    await navigate("/10.ronzz/abc123");
    const finalUrl = page.url();
    assert(
      finalUrl.includes("/doi/") || finalUrl.includes("/404") || finalUrl.includes("/500"),
      `Canonical DOI URL should land on a detail/error page, got: ${finalUrl}`,
    );
  });

  await test("Canonical DOI URL for a non-existent DOI lands on the 404 page", async () => {
    await navigate("/10.ronzz/zzznonexistent");
    const text = await getPageText();
    assert(text.includes("404"), `Should land on the 404 page, got: "${text.slice(0, 120)}"`);
  });

  await test("Multi-segment canonical DOI URL is accepted by the route", async () => {
    // 10.ronzz/country/FR-style suffixes must reach the resolver, not a
    // hard 404 from the SPA router (the DOI may not exist in the backend —
    // landing on the 404 page is the correct outcome).
    await navigate("/10.ronzz/country/FR");
    const text = await getPageText();
    assert(
      text.includes("404") || text.includes("Not Found") || text.includes("country"),
      `Multi-segment DOI should resolve to a page, got: "${text.slice(0, 120)}"`,
    );
  });

  console.log("\n--- EMBED PAGE ---");

  await test("Embed page renders error state for unknown DOI without JS errors", async () => {
    await navigate("/embed/10.ronzz/zzznonexistent");
    const text = await getPageText();
    // Either a clean 404 message or a snippet render — but never a crash
    assert(text.length > 0, "Embed page should render something");
  });

  await test("Embed page is frameable (no X-Frame-Options DENY)", async () => {
    const resp = await page.goto(`${FRONTEND_URL}/embed/10.ronzz/zzznonexistent`, { waitUntil: "domcontentloaded" });
    const xfo = resp.headers()["x-frame-options"];
    assert(xfo === undefined || !xfo.includes("DENY"),
      `X-Frame-Options should not block framing, got: ${xfo || "none"}`);
    const corp = resp.headers()["cross-origin-resource-policy"];
    assert(corp === "cross-origin", `CORP should be cross-origin, got: ${corp || "none"}`);
  });

  console.log("\n--- ERROR PAGES ---");

  await test("404 page renders correctly", async () => {
    await navigate("/nonexistent-page");
    const text = await getPageText();
    assert(text.includes("404"), "Should show '404'");
    assert(text.includes("Not Found") || text.includes("Page Not Found"), "Should mention Not Found");
    assert(text.includes("Back to Home"), "Should have 'Back to Home' link");
  });

  await test("429 page renders correctly", async () => {
    await navigate("/429");
    const text = await getPageText();
    assert(text.includes("429"), "Should show '429'");
    assert(text.includes("Too Many"), "Should mention rate limiting");
  });

  await test("500 page renders correctly", async () => {
    await navigate("/500");
    const text = await getPageText();
    assert(text.includes("500"), "Should show '500'");
    assert(text.includes("Server Error") || text.includes("Something went wrong"),
      "Should show server error message");
  });

  console.log("\n--- ERROR CHECK ---");

  await test("No unhandled page errors during entire session", async () => {
    assert(pageErrors.length === 0,
      `${pageErrors.length} unhandled page error(s):\n  ${pageErrors.join("\n  ")}`);
  });

  await test("No console errors during entire session (excluding expected HTTP statuses)", async () => {
    // Expected console errors — these are from the browser reporting HTTP status codes
    // of error pages, which is correct behavior:
    //   - 404: from /nonexistent-page and /favicon.ico
    //   - 500: from /500 (the page correctly returns 500 status)
    //   - CSP: the embed page's strict CSP blocks the Vite dev-client scripts
    //     (@vite/client, dev-toolbar) — dev-only artifacts absent in production builds
    const filtered = consoleErrors.filter(
      (e) =>
        !e.includes("404") &&
        !e.includes("500") &&
        !e.includes("Content Security Policy"),
    );
    assert(filtered.length === 0,
      `${filtered.length} unexpected console error(s) (excluding expected API/page status codes):\n  ${filtered.join("\n  ")}`);
  });

  // Summary
  console.log();
  if (pageErrors.length > 0) {
    console.log(`  [ERROR] ${pageErrors.length} unhandled page error(s) during session`);
  }
  if (consoleErrors.length > 0) {
    console.log(`  [ERROR] ${consoleErrors.length} console error(s) during session`);
  }
  console.log(`RESULTS (E2E Smoke): ${passed} passed, ${failed} failed`);

  process.exit(failed > 0 ? 1 : 0);
}

// ── Bootstrap ──────────────────────────────────────────────────────────────

(async () => {
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: CHROME_PATH,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
    });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    page = await context.newPage();

    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
      console.log("  [BROWSER ERROR]", err.message);
    });
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
        console.log("  [CONSOLE ERROR]", msg.text());
      }
    });

    await runTests();
  } catch (e) {
    console.error("FATAL:", e.message);
    if (browser) await browser.close().catch(() => {});
    process.exit(1);
  }
})();
