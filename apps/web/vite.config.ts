import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

// Brotli at its strongest: slow, but it runs once per build, not per request.
function brotli(data: Buffer | string): Buffer {
  return brotliCompressSync(data, {
    params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
  });
}

// Text files only: images and fonts are compressed already.
const compressible = /\.(html|js|css|svg|json|txt|webmanifest)$/;

// Writes a .br and a .gz copy next to every text file of the build, which
// @fastify/static sends by the request's Accept-Encoding (ADR 0013,
// decision 5; ADR 0023, decision 3).
function precompress(): Plugin {
  let outDir = "";
  return {
    name: "szop:precompress",
    apply: "build",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    // After every file is written, those copied from public/ included.
    async closeBundle() {
      const entries = await readdir(outDir, {
        recursive: true,
        withFileTypes: true,
      });
      for (const entry of entries) {
        if (!entry.isFile() || !compressible.test(entry.name)) continue;
        const file = join(entry.parentPath, entry.name);
        const data = await readFile(file);
        await writeFile(`${file}.br`, brotli(data));
        await writeFile(`${file}.gz`, gzipSync(data, { level: 9 }));
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), precompress()],
  server: {
    proxy: {
      // The API's address from apps/api/.env.example. A constant, not a
      // setting: it only exists in development, since the API serves the SPA
      // itself in production (ADR 0021, decision 3).
      "/api": "http://127.0.0.1:3000",
    },
  },
});
