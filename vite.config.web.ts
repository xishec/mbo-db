import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Web-only configuration (without Electron)
export default defineConfig({
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString().replace('T', ' ').split('.')[0]),
  },
  build: {
    sourcemap: false,
    outDir: "dist",
  },
  plugins: [react()],
});
