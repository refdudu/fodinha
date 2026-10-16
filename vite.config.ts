import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // Vercel usa a raiz. GitHub Pages sobrescreve a base no seu workflow.
  base: "/",
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
        start_url: "./",
        scope: "./",
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
