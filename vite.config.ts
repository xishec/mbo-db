import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import electron from "vite-plugin-electron";
import renderer from "vite-plugin-electron-renderer";
import { writeFileSync } from "fs";

// Plugin to fix CommonJS exports in Electron files
function fixElectronCJS(): Plugin {
  return {
    name: "fix-electron-cjs",
    writeBundle(options, bundle) {
      if (options.dir?.includes("dist-electron")) {
        for (const [fileName, output] of Object.entries(bundle)) {
          if (fileName.endsWith(".cjs") && "code" in output) {
            const fixed = output.code
              // rollup sometimes leaves ESM-style imports even when output format is CJS
              .replace(/^import\s+\{\s*([^}]+)\s*\}\s+from\s+"([^"]+)";$/gm, "const { $1 } = require(\"$2\");")
              .replace(/^import\s+([\w$]+)\s+from\s+"([^"]+)";$/gm, "const $1 = require(\"$2\");")
              .replace(/export default require_(\w+)\(\);?/g, "require_$1();");
            writeFileSync(`${options.dir}/${fileName}`, fixed);
          }
        }
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig(() => ({
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString().replace('T', ' ').split('.')[0]),
  },
  build: {
    sourcemap: false,
  },
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
  ],
}));
