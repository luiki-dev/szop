// Stryker disable all: one configuration line, which the E2E CSP guard checks
import { z } from "zod";

// Turns off zod's compiled fast path in the browser. Without it, zod probes
// for eval support with `new Function("")` when the shared schemas are built,
// and the CSP (no 'unsafe-eval', ADR 0012, decision 8) blocks and reports
// that probe on every page load, failing the E2E CSP guard (ADR 0026). zod
// skips the probe under jitless. Imported first in main.tsx, so it runs
// before @szop/shared's schemas are created.
z.config({ jitless: true });
