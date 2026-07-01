import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const pagesBase = "/Karmascope/";

export default defineConfig(({ mode }) => {
  const isPagesBuild = mode === "pages";

  return {
    base: isPagesBuild ? pagesBase : "/",
    plugins: [react(), tailwindcss()],
  };
});
