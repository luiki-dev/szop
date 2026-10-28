export default {
  // The Vitest runner on the root config, so Stryker runs the same projects
  // as `pnpm test` (ADR 0055).
  // pnpm does not hoist the runner next to core, where Stryker would look.
  plugins: [import.meta.resolve("@stryker-mutator/vitest-runner")],
  testRunner: "vitest",
  vitest: { configFile: "vitest.config.ts" },
  // Runs only the tests that cover a mutant, not the whole suite.
  coverageAnalysis: "perTest",
  // Application logic only: tests, test helpers, declarations and the
  // generated shadcn/ui components are left out.
  mutate: [
    "apps/api/src/**/*.ts",
    "apps/web/src/**/*.{ts,tsx}",
    "packages/shared/src/**/*.ts",
    "!**/*.test.{ts,tsx}",
    "!apps/*/src/test/**",
    "!**/*.d.ts",
    "!apps/web/src/components/ui/**",
  ],
  // No threshold: the score is read, not enforced (ADR 0007, decision 19).
  reporters: ["clear-text", "progress", "html"],
  htmlReporter: { fileName: "reports/mutation/mutation.html" },
};
