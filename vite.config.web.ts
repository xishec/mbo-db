import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Web-only configuration (without Electron)
export default defineConfig({
  build: {
    sourcemap: false,
    outDir: "dist",
  },
  plugins: [react()],
});
