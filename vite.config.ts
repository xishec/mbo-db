import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toLocaleString("en-CA", { timeZone: "America/Montreal", hour12: false })),
  },
  build: {
    sourcemap: false,
    outDir: "dist",
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        skipWaiting: true,
        clientsClaim: true,
      },
      manifest: {
        name: "MBO Database",
        short_name: "MBO DB",
        description: "Bird banding database for McGill Bird Observatory",
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/icon-256.png",
            sizes: "256x256",
            type: "image/png",
          },
          {
            src: "/icon-1024.png",
            sizes: "1024x1024",
            type: "image/png",
            purpose: "any",
          },
        ],
      },
    }),
  ],
});
