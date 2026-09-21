import type { Config } from "tailwindcss";
import { mshwarTheme } from "./src/styles/generated/tailwind-theme";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: mshwarTheme,
  },
  plugins: [],
};

export default config;
