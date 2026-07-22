<script lang="ts">
  let { q = "", doi_type = "", mode = "fts" }: { q?: string; doi_type?: string; mode?: string } = $props();

  let query = $state(q);
  let typeFilter = $state(doi_type);
  let searchMode = $state(mode);
  let isSearching = $state(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    isSearching = true;
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (typeFilter) params.set("doi_type", typeFilter);
    if (searchMode !== "fts") params.set("mode", searchMode);
    window.location.href = `/search?${params.toString()}`;
  }

  const modeOptions = [
    { value: "fts", label: "Exact words" },
    { value: "semantic", label: "Fuzzy match" },
  ];
</script>

<form action="/search" method="get" onsubmit={handleSubmit} class="space-y-3">
  <div class="flex gap-2">
    <input
      type="text"
      name="q"
      bind:value={query}
      placeholder="Search DOIs…"
      aria-label="Search query"
      class="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
    />
    <button
      type="submit"
      disabled={isSearching}
      class="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
    >
      {isSearching ? "Searching…" : "Search"}
    </button>
  </div>

  <div class="flex flex-wrap items-center gap-4 text-sm">
    <label class="flex items-center gap-1">
      <span class="text-gray-600">Type:</span>
      <select
        name="doi_type"
        bind:value={typeFilter}
        class="rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
      >
        <option value="">All types</option>
        <option value="person">Person</option>
        <option value="country">Country</option>
        <option value="abstract_entity">Organization</option>
        <option value="book">Book</option>
        <option value="bookSection">Book Section</option>
        <option value="scientificPaper">Scientific Paper</option>
        <option value="conferencePaper">Conference Paper</option>
        <option value="presentation">Presentation</option>
        <option value="report">Report</option>
        <option value="dataset">Dataset</option>
        <option value="webpage">Webpage</option>
        <option value="magazineArticle">Magazine Article</option>
        <option value="newspaperArticle">Newspaper Article</option>
        <option value="film">Film</option>
        <option value="podcast">Podcast</option>
        <option value="song">Song</option>
        <option value="media">Media</option>
        <option value="circulaire">Circulaire</option>
        <option value="rulebook">Rulebook</option>
        <option value="document">Document</option>
      </select>
    </label>

    <div class="flex items-center gap-1">
      <span class="text-gray-600">Mode:</span>
      <div class="inline-flex rounded-lg border border-gray-300 overflow-hidden" role="radiogroup" aria-label="Search mode">
        {#each modeOptions as m}
          <button
            type="button"
            role="radio"
            aria-checked={searchMode === m.value}
            onclick={() => (searchMode = m.value)}
            class="px-3 py-1.5 text-sm font-medium transition {searchMode === m.value ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}"
          >
            {m.label}
          </button>
        {/each}
      </div>
    </div>

    <!-- Hidden input submits mode with the form (no-JS fallback) -->
    <input type="hidden" name="mode" value={searchMode} />
  </div>
</form>
