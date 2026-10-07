import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // The API's address from apps/api/.env.example. A constant, not a
      // setting: it only exists in development, since the API serves the SPA
      // itself in production (ADR 0021, decision 3).
      "/api": "http://127.0.0.1:3000",
    },
  },
});
