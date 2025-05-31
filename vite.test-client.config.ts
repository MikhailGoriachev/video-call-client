import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  root: path.resolve(__dirname, "src/test-client"),
  base: "./",
  build: {
    outDir: path.resolve(__dirname, "dist/test-client"),
    sourcemap: true,
    rollupOptions: {
      input: path.resolve(__dirname, "src/test-client/index.html"),
    },
  },
  resolve: {
    alias: {
      "@sdk": path.resolve(__dirname, "src/sdk"),
    },
  },
});
