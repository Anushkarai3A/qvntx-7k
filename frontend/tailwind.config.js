/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "#000000",
        carbon: "#050607",
        ghost: "#ffffff",
        bone: "#e8eaee",
        ash: "#b3b3b3",
        steel: "#808080",
        graphite: "#333333",
        lavender: "#9984d8",
        mint: "#3fcb7f",
        danger: "#e9b4b4",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        display: [
          "Cormorant Garamond",
          "EB Garamond",
          "PT Serif",
          "Georgia",
          "serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      borderRadius: {
        card: "16px",
        control: "6px",
      },
      maxWidth: {
        page: "1200px",
      },
      letterSpacing: {
        functional: "-0.02em",
      },
    },
  },
  plugins: [],
};
