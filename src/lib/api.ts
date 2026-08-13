import type {
  PublicDOIResponse,
  PublicSearchResponse,
  PublicCitationResponse,
  PublicSnippetResponse,
  PublicHealthResponse,
  SearchMode,
  CitationStyle,
} from "./types";
import {
  ApiError,
  BadRequestError,
  GoneError,
  NotFoundError,
  RateLimitedError,
} from "./errors";

function getBaseUrl(): string {
  const url = import.meta.env.API_BASE_URL;
  if (!url) {
    throw new Error("API_BASE_URL environment variable is not set");
  }
  return url.replace(/\/+$/, "");
}

async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const base = getBaseUrl();
  const url = `${base}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail = body.detail ?? body.error ?? response.statusText;

    switch (response.status) {
      case 400:
        throw new BadRequestError(detail);
      case 404:
        throw new NotFoundError(detail);
      case 410:
        throw new GoneError(detail);
      case 429:
        throw new RateLimitedError(detail);
      default:
        throw new ApiError(response.status, detail);
    }
  }

  return response.json() as Promise<T>;
}

/**
 * Fetch a single DOI record.
 */
export function fetchDOI(doi: string): Promise<PublicDOIResponse> {
  return apiFetch<PublicDOIResponse>(`/public/v1/doi/${encodeURIComponent(doi)}`);
}

/**
 * Search DOIs.
 */
export function searchDOIs(
  q: string,
  options?: {
    doi_type?: string;
    mode?: SearchMode;
    limit?: number;
    offset?: number;
  },
): Promise<PublicSearchResponse> {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (options?.doi_type) params.set("doi_type", options.doi_type);
  if (options?.mode) params.set("mode", options.mode);
  if (options?.limit !== undefined) params.set("limit", String(options.limit));
  if (options?.offset !== undefined) params.set("offset", String(options.offset));

  return apiFetch<PublicSearchResponse>(`/public/v1/search?${params.toString()}`);
}

/**
 * Fetch a formatted citation.
 */
export function fetchCitation(
  doi: string,
  style: CitationStyle = "apa",
): Promise<PublicCitationResponse> {
  const params = new URLSearchParams({ doi, style });
  return apiFetch<PublicCitationResponse>(`/public/v1/citation?${params.toString()}`);
}

/**
 * Fetch snippet content for embedding.
 */
export function fetchSnippet(doi: string): Promise<PublicSnippetResponse> {
  return apiFetch<PublicSnippetResponse>(`/public/v1/snippet/${encodeURIComponent(doi)}`);
}

/**
 * Fetch server health.
 */
export function fetchHealth(): Promise<PublicHealthResponse> {
  return apiFetch<PublicHealthResponse>("/public/v1/health");
}
