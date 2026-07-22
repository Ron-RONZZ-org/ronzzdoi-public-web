<script lang="ts">
  let { mode = "fts" }: { mode?: string } = $props();

  let currentMode = $state(mode);

  const modes = [
    { value: "fts", label: "Exact words" },
    { value: "semantic", label: "Fuzzy match" },
  ];

  function select(value: string) {
    currentMode = value;
  }
</script>

<div class="inline-flex rounded-lg border border-gray-300 overflow-hidden" role="radiogroup" aria-label="Search mode">
  {#each modes as m}
    <button
      type="button"
      role="radio"
      aria-checked={currentMode === m.value}
      onclick={() => select(m.value)}
      class="px-3 py-1.5 text-sm font-medium transition {currentMode === m.value ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}"
    >
      {m.label}
    </button>
  {/each}
</div>

<!-- Sync hidden input -->
<input type="hidden" name="mode" value={currentMode} />
