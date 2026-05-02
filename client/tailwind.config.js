import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    path.join(here, "index.html"),
    path.join(here, "src/**/*.{ts,tsx}"),
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "system-ui",
          "Segoe UI",
          "Tahoma",
          "Cairo",
          "Noto Naskh Arabic",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
