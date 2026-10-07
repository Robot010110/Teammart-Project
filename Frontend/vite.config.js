import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    // Vite 5.4+ blocks requests carrying a Host header it doesn't
    // recognize (DNS-rebinding protection), which also blocks a
    // Cloudflare quick-tunnel hostname since it changes every run.
    // Scoped to trycloudflare.com rather than `true` (any host) so this
    // stays safe if the dev server is ever exposed more broadly.
    allowedHosts: [".trycloudflare.com"],
    // Forward /api to the backend so ONE public URL (e.g. a Cloudflare
    // quick tunnel, which exposes a single port) serves both the app and
    // its API. Only used when the frontend is started with
    // VITE_API_URL=/api; without it the app still talks to :4000 directly.
    // changeOrigin stays false on purpose: the backend builds upload URLs
    // from Host / X-Forwarded-Proto, which must stay the public ones.
    proxy: {
      "/api": { target: "http://localhost:4000" },
    },
  },
});
