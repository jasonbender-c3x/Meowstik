import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * [💭 Analysis]
 * Optimized Vite Configuration - System Revision 3.4.2
 * Ensuring absolute path resolution for assets to prevent 
 * "Failed to resolve import" errors in nested pages.
 */

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "client", "src", "assets"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "..", "dist", "public"),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    host: "0.0.0.0", // Required for sovereign access
  }
});