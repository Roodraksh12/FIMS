import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Send /api requests from the frontend dev server to the local Node backend.
const proxy = {
  "/api": {
    target: "http://127.0.0.1:" + (process.env.FIMS_API_PORT ?? "4174"),
  },
};
export default defineConfig({
  root: "frontend",
  plugins: [react()],
  server: {
    proxy,
    fs: { allow: [fileURLToPath(new URL(".", import.meta.url))] },
  },
  preview: { proxy },
  test: { root: ".", environment: "node", include: ["tests/**/*.test.ts"] },
});
