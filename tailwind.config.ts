import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./providers/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#0c1428",
          light: "#1a2440",
        },
        lvi: {
          blue: "#2B5CE6",
          "blue-dark": "#1e45c8",
          "blue-light": "#eef2ff",
          green: "#10b981",
          amber: "#f59e0b",
          red: "#ef4444",
          bg: "#f2f5fc",
          surf: "#ffffff",
        },
      },
      fontFamily: {
        sans: ["DM Sans", "system-ui", "-apple-system", "sans-serif"],
        display: ["Space Grotesk", "system-ui", "-apple-system", "sans-serif"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
      },
      boxShadow: {
        glass: "0 4px 20px rgba(43,92,230,.06), 0 1px 3px rgba(0,0,0,.04)",
        "glass-hover": "0 10px 40px rgba(43,92,230,.13), 0 2px 8px rgba(0,0,0,.05)",
      },
      animation: {
        "fade-in": "fadeSlideIn 0.38s cubic-bezier(.23,1,.32,1) both",
        "lvi-pulse": "lviPulse 2s ease-in-out infinite",
      },
      keyframes: {
        fadeSlideIn: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        lviPulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
