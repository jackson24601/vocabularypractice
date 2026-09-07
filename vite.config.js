import { resolve } from "node:path";
import { defineConfig } from "vite";

// GitHub Pages serves this repo at /vocabularypractice/
const base = process.env.VITE_BASE || "/";

export default defineConfig({
  base,
  root: ".",
  server: {
    host: true,
    port: 5173,
    proxy: {
      // jsonhosting.com does not send CORS headers; proxy it in local dev.
      "/json-store": {
        target: "https://jsonhosting.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/json-store/, "/api/json"),
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        student: resolve(__dirname, "student.html"),
        report: resolve(__dirname, "report.html"),
      },
    },
  },
});
