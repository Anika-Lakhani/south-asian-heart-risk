import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Served from https://anika-lakhani.github.io/south-asian-heart-risk/
export default defineConfig({
  base: "/south-asian-heart-risk/",
  plugins: [react(), tailwindcss()],
  // The tests read reference fixtures shared with the Python package at the repo root.
  server: { port: 5173, fs: { allow: [".."] } },
});
