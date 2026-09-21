import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/react-vite";

const dirname = path.dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-a11y"],
  framework: "@storybook/react-vite",
  async viteFinal(config) {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias as Record<string, string>),
      "@": path.resolve(dirname, "../src"),
      "next/link": path.resolve(dirname, "../src/test-mocks/next-link.tsx"),
      "next/navigation": path.resolve(dirname, "../src/test-mocks/next-navigation.ts"),
    };
    return config;
  },
};

export default config;
