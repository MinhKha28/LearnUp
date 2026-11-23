import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Test .tsx render bằng react-dom/server, cần JSX runtime tự động như tsconfig "react-jsx"
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "vitest-environment-jsdom-native": fileURLToPath(new URL("./dev/jsdom.native.environment.ts", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", "dev/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
