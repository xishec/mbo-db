import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import electron from "vite-plugin-electron";
import renderer from "vite-plugin-electron-renderer";
import { writeFileSync, readFileSync } from "fs";

// Plugin to fix CommonJS exports in Electron files
function fixElectronCJS(): Plugin {
  return {
    name: "fix-electron-cjs",
    writeBundle(options, bundle) {
      if (options.dir?.includes("dist-electron")) {
        for (const [fileName, output] of Object.entries(bundle)) {
          if (fileName.endsWith(".cjs") && "code" in output) {
            const fixed = output.code.replace(/export default require_(\w+)\(\);?/g, "require_$1();");
            writeFileSync(`${options.dir}/${fileName}`, fixed);
          }
        }
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: "electron/main.ts",
        vite: {
          build: {
            minify: false,
            rollupOptions: {
              output: {
                format: "cjs",
                exports: "auto",
                entryFileNames: "[name].cjs",
              },
            },
          },
          plugins: [fixElectronCJS()],
        },
      },
      {
        entry: "electron/preload.ts",
        onstart(options) {
          // Notify the Renderer process to reload the page when the Preload scripts build is complete
          options.reload();
        },
        vite: {
          build: {
            minify: false,
            rollupOptions: {
              output: {
                format: "cjs",
                exports: "auto",
                entryFileNames: "[name].cjs",
              },
            },
          },
          plugins: [fixElectronCJS()],
        },
      },
    ]),
    renderer(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["mbo-favicon.svg", "mbo-logo.svg"],
      manifest: {
        name: "MBO Database",
        short_name: "MBO-DB",
        description: "Bird banding database for MBO",
        theme_color: "#3b82f6",
        background_color: "#ffffff",
        display: "standalone",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "mbo-favicon.svg",
            sizes: "192x192",
            type: "image/svg+xml",
          },
          {
            src: "mbo-logo.svg",
            sizes: "512x512",
            type: "image/svg+xml",
          },
          {
            src: "mbo-logo.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "gstatic-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
});
