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
            const fixed = output.code.replace(/export default require_(\w+)\(\);?/g, "require_$1();");
            writeFileSync(`${options.dir}/${fileName}`, fixed);
          }
        }
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig(() => ({
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
