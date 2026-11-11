import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: "#1E255E",
          "navy-hover": "#151A46",
          "navy-light": "#EEF2FF",
          "navy-border": "#C7D2FE",
          gold: "#D97706",
          "gold-light": "#FEF3C7",
          "gold-border": "#FDE68A",
          blue: "#2563EB",
          "blue-light": "#EFF6FF",
          success: "#059669",
          "success-light": "#ECFDF5",
          danger: "#DC2626",
          "danger-hover": "#B91C1C",
          "danger-light": "#FEF2F2",
          "danger-border": "#FECACA",
        },
      },
      fontFamily: {
        sans: ["var(--font-jakarta)", "Plus Jakarta Sans", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;

