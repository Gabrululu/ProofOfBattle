/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      colors: {
        background: "var(--color-background)",
        foreground: "var(--color-foreground)",
        muted: "var(--color-muted)",
        primary: {
          DEFAULT: "var(--color-primary)",
          deep: "var(--color-primary-deep)",
        },
        secondary: {
          DEFAULT: "var(--color-secondary)",
          deep: "var(--color-secondary-deep)",
        },
        accent: "var(--color-accent)",
        border: "var(--color-border)",
        surface: "var(--color-surface)",
      },
    },
  },
  plugins: [],
};
