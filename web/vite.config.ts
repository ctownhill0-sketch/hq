/// <reference types="vitest/config" />
import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// Express (the API) listens on 127.0.0.1:PORT. In development Vite also binds to
// 127.0.0.1 only and proxies /api to Express. The Origin header is rewritten to
// the API's own origin so the server's same-origin CSRF check still applies.
const apiPort = Number(process.env.PORT || 4317);
const apiOrigin = `http://127.0.0.1:${apiPort}`;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: apiOrigin,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("proxyReq", (req) => {
            if (req.getHeader("origin")) req.setHeader("origin", apiOrigin);
          });
        },
      },
    },
  },
  preview: { host: "127.0.0.1", port: 4173, strictPort: true },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    // No inline scripts or styles in the output: the strict CSP stays intact.
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
  },
});
