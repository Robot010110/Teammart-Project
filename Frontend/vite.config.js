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
  },
});
