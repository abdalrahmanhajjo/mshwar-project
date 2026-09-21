import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "next/link": path.resolve(__dirname, "./src/test-mocks/next-link.tsx"),
      "next/navigation": path.resolve(__dirname, "./src/test-mocks/next-navigation.ts"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/vitest-setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: "./coverage",
      exclude: [
        "**/*.stories.tsx",
        ".storybook/**",
        "src/vitest-setup.ts",
        "src/styles/generated/**",
        "src/app/**",
        "src/lib/config.ts",
        "src/test-mocks/**",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
