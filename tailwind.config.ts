import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./features/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#FBF6F1",
        card: "#ffffff",
        ink: "#2B2320",
        muted: "#8A7A6E",
        border: "#EEE0D3",
        orange: { DEFAULT: "#FF914D", deep: "#F0862E", light: "#FFF1E4" },
        rust: { DEFAULT: "#A8532A", dark: "#7C3C1D" },
        keystone: { green: "#059669", amber: "#d97706", red: "#dc2626", blue: "#2563eb" },
      },
      borderRadius: { keystone: "12px" },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
