import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Keep Vite rooted at the frontend project. Tauri owns src-tauri and its
  // Cargo watcher; Vite must never subscribe to that tree on Windows.
  root: ".",
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: "127.0.0.1",
    watch: {
      ignored: [
        "**/src-tauri/**",
        "**/src-tauri/target/**",
        "**/target/**"
      ]
    }
  },
  envPrefix: ["VITE_", "TAURI_ENV_"],
  build: { target: ["es2021", "chrome105", "safari13"] }
});
