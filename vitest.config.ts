import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  define: {
    "import.meta.env.API_BASE_URL": JSON.stringify("http://test-api.ronzz.org"),
  },
});
