import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8080",
      "/chat": "http://localhost:8080",
      "/health": "http://localhost:8080",
      // LangGraph FetchStreamTransport SSE endpoint
      "/stream": {
        target: "http://localhost:8080",
        changeOrigin: true,
        // Disable response buffering so SSE events flush immediately
        configure: (proxy) => {
          proxy.on("proxyRes", (proxyRes) => {
            proxyRes.headers["x-accel-buffering"] = "no";
          });
        },
      },
      // Keep WS proxy for CLI mode / backward compat
      "/ws": {
        target: "ws://localhost:8080",
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
