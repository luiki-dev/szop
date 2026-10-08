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

// NFR-3: the JavaScript the first screen needs is at most 200 KB compressed
// (ADR 0013, decision 4). It is the entry chunk and every chunk it imports
// statically; chunks loaded later through import() do not count. Measured
// in Brotli, what browsers download (ADR 0023, decision 4).
function firstScreenBudget(limitBytes: number): Plugin {
  return {
    name: "szop:first-screen-budget",
    apply: "build",
    writeBundle(_options, bundle) {
      const chunks = new Map(
        Object.values(bundle)
          .filter((output) => output.type === "chunk")
          .map((chunk) => [chunk.fileName, chunk]),
      );
      const entry = [...chunks.values()].find((chunk) => chunk.isEntry);
      if (!entry) throw new Error("first-screen budget: no entry chunk");

      const counted = new Set<string>();
      const queue = [entry.fileName];
      let bytes = 0;
      for (let name = queue.pop(); name !== undefined; name = queue.pop()) {
        const chunk = chunks.get(name);
        if (!chunk || counted.has(name)) continue;
        counted.add(name);
        bytes += brotli(chunk.code).length;
        queue.push(...chunk.imports);
      }

      const kb = (n: number): string => (n / 1024).toFixed(1);
      const summary = `first-screen JavaScript: ${kb(bytes)} KB Brotli of ${kb(limitBytes)} KB (${String(counted.size)} chunks)`;
      if (bytes > limitBytes) {
        throw new Error(`${summary}: over budget (NFR-3)`);
      }
      console.log(summary);
    },
  };
}

export default defineConfig({
  plugins: [react(), precompress(), firstScreenBudget(200 * 1024)],
  server: {
    proxy: {
      // The API's address from apps/api/.env.example. A constant, not a
      // setting: it only exists in development, since the API serves the SPA
      // itself in production (ADR 0021, decision 3).
      "/api": "http://127.0.0.1:3000",
    },
  },
});
