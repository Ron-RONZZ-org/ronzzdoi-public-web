import { describe, it, expect, beforeEach, vi } from "vitest";
import { fetchDOI, searchDOIs, fetchCitation, fetchHealth, fetchSnippet } from "./api";
import { NotFoundError, GoneError, RateLimitedError, BadRequestError } from "./errors";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe("fetchDOI", () => {
  it("returns PublicDOIResponse on 200", async () => {
    const body = {
      doi: "10.ronzz/abc123",
      target_url: "https://example.com",
      title: "Test Record",
      doi_type: "webpage",
      metadata: { authors: [], website_name: "Example" },
      created_at: "2024-01-01T00:00:00Z",
      snippet: null,
    };
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(body),
    });

    const result = await fetchDOI("10.ronzz/abc123");
    expect(result.doi).toBe("10.ronzz/abc123");
    expect(result.title).toBe("Test Record");
    expect(result.doi_type).toBe("webpage");

    // Verify correct URL was called
    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain("/public/v1/doi/10.ronzz%2Fabc123");
  });

  it("throws NotFoundError on 404", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ detail: "DOI not found" }),
    });

    await expect(fetchDOI("10.ronzz/unknown")).rejects.toThrow(NotFoundError);
  });

  it("throws GoneError on 410", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 410,
      json: () => Promise.resolve({ detail: "DOI has been deleted" }),
    });

    await expect(fetchDOI("10.ronzz/deleted")).rejects.toThrow(GoneError);
  });

  it("throws RateLimitedError on 429", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      json: () => Promise.resolve({ detail: "Rate limit exceeded" }),
    });

    await expect(fetchDOI("10.ronzz/rate-limited")).rejects.toThrow(RateLimitedError);
  });

  it("throws BadRequestError on 400", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ detail: "Ambiguous prefix" }),
    });

    await expect(fetchDOI("bad")).rejects.toThrow(BadRequestError);
  });
});

describe("searchDOIs", () => {
  it("sends query params correctly", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ items: [], total: 0, limit: 20, offset: 0, mode: "fts" }),
    });

    await searchDOIs("test query", { doi_type: "book", mode: "fts", limit: 10, offset: 20 });

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    const urlObj = new URL(calledUrl);
    expect(urlObj.searchParams.get("q")).toBe("test query");
    expect(urlObj.searchParams.get("doi_type")).toBe("book");
    expect(urlObj.searchParams.get("mode")).toBe("fts");
    expect(urlObj.searchParams.get("limit")).toBe("10");
    expect(urlObj.searchParams.get("offset")).toBe("20");
  });

  it("handles empty query", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ items: [], total: 0, limit: 20, offset: 0, mode: "fts" }),
    });

    const result = await searchDOIs("");
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("returns semantic mode results", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        items: [
          { doi: "10.ronzz/abc", title: "Related", doi_type: "book", metadata: {}, created_at: "", snippet: null, target_url: null },
        ],
        total: 1, limit: 20, offset: 0, mode: "semantic",
      }),
    });

    const result = await searchDOIs("concept", { mode: "semantic" });
    expect(result.mode).toBe("semantic");
    expect(result.items).toHaveLength(1);
    expect(result.items[0].doi).toBe("10.ronzz/abc");
  });
});

describe("fetchCitation", () => {
  it("returns citation text on 200", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ doi: "10.ronzz/abc", style: "apa", citation: "Doe, J. (2024). Title." }),
    });

    const result = await fetchCitation("10.ronzz/abc", "apa");
    expect(result.style).toBe("apa");
    expect(result.citation).toBe("Doe, J. (2024). Title.");
  });

  it("sends style param", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ doi: "10.ronzz/abc", style: "vancouver", citation: "..." }),
    });

    await fetchCitation("10.ronzz/abc", "vancouver");
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("style=vancouver");
  });
});

describe("fetchHealth", () => {
  it("returns health status", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ status: "ok", version: "0.1.0" }),
    });

    const result = await fetchHealth();
    expect(result.status).toBe("ok");
    expect(result.version).toBe("0.1.0");
  });
});

describe("fetchSnippet", () => {
  it("returns snippet content on 200", async () => {
    const body = {
      doi: "10.ronzz/abc123",
      title: "A Quote",
      content_kind: "text",
      content: "To be or not to be",
      language: "",
      source_doi: "10.ronzz/book1",
      page_start: "12",
      page_end: "",
      created_at: "2026-01-01T00:00:00Z",
    };
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(body),
    });

    const result = await fetchSnippet("10.ronzz/abc123");
    expect(result.content_kind).toBe("text");
    expect(result.content).toBe("To be or not to be");

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain("/public/v1/snippet/10.ronzz%2Fabc123");
  });

  it("throws NotFoundError on 404", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ detail: "DOI not found" }),
    });

    await expect(fetchSnippet("10.ronzz/unknown")).rejects.toThrow(NotFoundError);
  });

  it("throws GoneError on 410 (tombstoned)", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 410,
      json: () => Promise.resolve({ detail: "DOI has been deleted" }),
    });

    await expect(fetchSnippet("10.ronzz/deleted")).rejects.toThrow(GoneError);
  });
});
