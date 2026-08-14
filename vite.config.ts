import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  plugins: [
    tanstackStart({ server: { entry: "server" } }),
    // Required for Vercel: compiles the TanStack Start server into a Vercel Function.
    // Without this, Vercel builds the app but has no server output to serve SSR
    // routes from, so the deployed page fails to load even though the build "succeeds".
    nitro(),
    tailwindcss(),
    react(),
  ],
  resolve: {
    tsconfigPaths: true,
    dedupe: ["react", "react-dom"],
  },
});
