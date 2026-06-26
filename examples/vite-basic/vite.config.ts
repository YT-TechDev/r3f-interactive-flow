import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "r3f-interactive-flow": new URL(
        "../../packages/r3f-interactive-flow/src/index.ts",
        import.meta.url
      ).pathname
    }
  }
});
