import type { Preview } from "@storybook/react-vite";
import React from "react";
import "../src/app/globals.css";

const preview: Preview = {
  globalTypes: {
    theme: {
      description: "Color theme",
      toolbar: {
        title: "Theme",
        icon: "mirror",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
        dynamicTitle: true,
      },
    },
    direction: {
      description: "Text direction",
      toolbar: {
        title: "Direction",
        icon: "transferalt",
        items: [
          { value: "ltr", title: "LTR" },
          { value: "rtl", title: "RTL" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: "light",
    direction: "ltr",
  },
  decorators: [
    (Story, context) => {
      const theme = (context.globals.theme as string) ?? "light";
      const direction = (context.globals.direction as string) ?? "ltr";
      if (typeof document !== "undefined") {
        document.documentElement.classList.toggle("dark", theme === "dark");
        document.documentElement.setAttribute("data-theme", theme);
        document.documentElement.dir = direction;
        document.documentElement.lang = direction === "rtl" ? "ar" : "en";
      }
      return React.createElement(
        "div",
        {
          className: theme === "dark" ? "dark min-h-screen bg-surface text-text" : "min-h-screen bg-surface text-text",
          dir: direction,
          "data-theme": theme,
        },
        React.createElement(Story),
      );
    },
  ],
  parameters: {
    a11y: {
      test: "error",
    },
    viewport: {
      options: {
        mobile390: { name: "390px", styles: { width: "390px", height: "844px" } },
        desktop1440: { name: "1440px", styles: { width: "1440px", height: "900px" } },
      },
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
