import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// @tauri-apps/cli sets this; used to tune the dev server for the Tauri shell.
const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // Tauri expects a fixed port and fails if it is not available.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // Don't watch the Rust backend from Vite.
      ignored: ["**/src-tauri/**"],
    },
  },

  // Produce a smaller, modern bundle for the WebKit runtime Tauri ships with.
  build: {
    target: "es2021",
    minify: "esbuild",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          livekit: ["livekit-client", "@livekit/components-react"],
          supabase: ["@supabase/supabase-js"],
        },
      },
    },
  },
}));
