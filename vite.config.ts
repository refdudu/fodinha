import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/fodinha/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Fodinha — Contador",
        short_name: "Fodinha",
        description: "Contador de vidas, palpites e vazas para o truco gaúcho.",
        lang: "pt-BR",
        start_url: "/fodinha/",
        scope: "/fodinha/",
        display: "standalone",
        background_color: "#101318",
        theme_color: "#101318",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
        ]
      }
    })
  ],
  test: {
    environment: "node"
  }
});
