import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const pagesBase = "/Karmascope/";
const outDir = "dist";

function spaFallback(): PluginOption {
  return {
    name: "spa-fallback",
    apply: "build",
    closeBundle: async () => {
      // @ts-expect-error This app does not install Node ambient types.
      const { copyFile } = (await import("node:fs/promises")) as {
        copyFile: (source: string, destination: string) => Promise<void>;
      };

      await copyFile(`${outDir}/index.html`, `${outDir}/404.html`);
    },
  };
}

export default defineConfig(({ mode }) => {
  const isPagesBuild = mode === "pages";

  return {
    base: isPagesBuild ? pagesBase : "/",
    build: { outDir },
    plugins: [react(), tailwindcss(), spaFallback()],
  };
});
