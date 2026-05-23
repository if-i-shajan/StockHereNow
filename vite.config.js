import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/firebase")) {
            return "firebase";
          }
          if (id.includes("node_modules/react-dom") || id.includes("node_modules/react-router")) {
            return "react-vendor";
          }
        },
      },
    },
  },
});
