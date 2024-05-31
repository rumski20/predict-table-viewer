import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: "./index.html",
      },
    },
  },
  assetsInclude: ["**/*.csv"], // Include CSV files as assets
  base: 'https://rumski20.github.io/predict-table-viewer/' // Add this line to set the base URL
});
