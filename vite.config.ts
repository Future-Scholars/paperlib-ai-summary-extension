import commonjs from "@rollup/plugin-commonjs";
import { builtinModules } from "module";
import path from "node:path";
import modify from "rollup-plugin-modify";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    minify: false,
    reportCompressedSize: true,
    lib: {
      entry: path.resolve(__dirname, "src/main.ts"),
      fileName: "main",
      formats: ["cjs"],
    },
    rollupOptions: {
      external: [...builtinModules],
      output: {
        format: "cjs",
      },
    },
    outDir: "dist",
    emptyOutDir: true,
  },

  esbuild: {
    keepNames: true,
  },

  resolve: {
    alias: {
      "@": path.join(__dirname, "src") + "/",
    },
  },

  plugins: [
    commonjs(),
    modify({
      find: /import\s*{\s*[\s\S]*}\s*from\s*"paperlib-api?/,
      replace: (match, path) => {
        const m = match
          .replace(/PLAPI\s*,?\s*/g, "")
          .replace(/PLExtAPI\s*,?\s*/g, "")
          .replace(/PLMainAPI\s*,?\s*/g, "");
        return m;
      },
    }),
  ],
});
