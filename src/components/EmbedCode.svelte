<script lang="ts">
  // Copy-to-clipboard island for embed code blocks.
  let { tag = "" } = $props();
  let copied = $state(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(tag);
      copied = true;
      setTimeout(() => { copied = false; }, 1500);
    } catch {
      copied = false;
    }
  }
</script>

<div class="flex items-start gap-2">
  <button
    type="button"
    onclick={copy}
    class="shrink-0 rounded-lg border border-gray-300 bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
  >
    {copied ? "Copied!" : "Copy"}
  </button>
  <code class="block overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 font-mono text-xs text-gray-600">
    {tag}
  </code>
</div>
