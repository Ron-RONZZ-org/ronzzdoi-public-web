// ─── Response shapes from the ronzzdoi public API ───

export interface PublicDOIResponse {
  doi: string;
  target_url: string | null;
  title: string;
  doi_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
  snippet: string | null;
  /** Set on search results that matched snippet content (unified search). */
  content_kind?: string | null;
}

export interface PublicSnippetResponse {
  doi: string;
  title: string;
  content_kind: "text" | "code" | "math";
  content: string;
  language: string;
  source_doi: string | null;
  page_start: string;
  page_end: string;
  created_at: string;
}

export interface PublicSearchResponse {
  items: PublicDOIResponse[];
  total: number;
  limit: number;
  offset: number;
  mode: "fts" | "semantic";
}

export interface PublicCitationResponse {
  doi: string;
  style: string;
  citation: string;
}

export interface PublicHealthResponse {
  status: string;
  version: string;
}

// ─── Search parameters ───

export type SearchMode = "fts" | "semantic";
export type CitationStyle = "apa" | "vancouver" | "json" | "mla" | "chicago";

// ─── doi_type values ───

export const DOI_TYPES = [
  "person",
  "country",
  "abstract_entity",
  "book",
  "bookSection",
  "scientificPaper",
  "conferencePaper",
  "presentation",
  "report",
  "dataset",
  "webpage",
  "magazineArticle",
  "newspaperArticle",
  "film",
  "podcast",
  "song",
  "media",
  "circulaire",
  "rulebook",
  "document",
] as const;

export type DoiType = (typeof DOI_TYPES)[number];

export const CITATION_STYLES = [
  { value: "apa" as const, label: "APA" },
  { value: "vancouver" as const, label: "Vancouver" },
  { value: "mla" as const, label: "MLA" },
  { value: "chicago" as const, label: "Chicago" },
  { value: "json" as const, label: "BibTeX" },
];

// ─── Citation view categories ───

export type CitationCategory =
  | "citation" // book, webpage, paper, etc.
  | "person"
  | "country"
  | "entity"
  | "tombstone"
  | "external"
  | "unresolved";

// ─── Metadata field helpers ───

export interface AuthorRef {
  person_doi?: string;
  given?: string;
  family?: string;
}

export interface PersonMeta {
  first_name: string;
  last_name: string;
}

export interface CountryMeta {
  iso_code: string;
}

export interface EntityMeta {
  legal_name: string;
  abbreviation?: string;
  description?: string;
  website?: string;
  jurisdiction?: string;
}

export interface BookMeta {
  authors: AuthorRef[];
  title: string;
  publisher: string;
  year: number | string;
  isbn?: string;
  edition?: string;
}

export interface WebpageMeta {
  authors: AuthorRef[];
  title: string;
  website_name: string;
  url: string;
  access_date: string;
  publication_date?: string;
}

export interface ScientificPaperMeta {
  authors: AuthorRef[];
  title: string;
  publication: string;
  year: number | string;
  subtype: "journal-article" | "preprint" | "thesis";
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
  archive?: string;
}
