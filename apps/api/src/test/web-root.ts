import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { brotliCompressSync, gzipSync } from "node:zlib";
import { afterAll, beforeAll } from "vitest";

// A built SPA in miniature: what apps/web's build writes, a file and its .br
// and .gz copies (ADR 0023, decision 8).
export const webRootFiles = {
  "index.html": '<!doctype html><title>Szop</title><div id="root"></div>',
  "assets/index-abc123.js": 'console.log("szop");',
} as const;

// Gives a test file a fresh copy in a temporary folder, removed afterwards.
// Call it at the top of the file; use `webRoot.path` inside the tests.
export function useWebRoot(): { readonly path: string } {
  let dir: string | undefined;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "szop-web-root-"));
    for (const [name, content] of Object.entries(webRootFiles)) {
      const file = join(dir, name);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, content);
      await writeFile(`${file}.br`, brotliCompressSync(content));
      await writeFile(`${file}.gz`, gzipSync(content));
    }
  });
  afterAll(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });
  return {
    get path(): string {
      if (!dir) throw new Error("useWebRoot's folder exists only inside tests");
      return dir;
    },
  };
}
