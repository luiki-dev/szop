import type { Config } from "../config.ts";

// A whole Config for tests; each test overrides only what it is about.
export function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    host: "127.0.0.1",
    port: 3000,
    logLevel: "silent",
    // Not used: each test passes its own database to buildApp.
    database: { host: "", port: 1, name: "", user: "", password: "" },
    // Not served: tests that serve the SPA pass their own folder.
    webRoot: "/nonexistent/szop-web-root",
    trustedProxies: [],
    ...overrides,
  };
}
