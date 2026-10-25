// @ts-check
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default defineConfig(
  // Docs hold no code; .superpowers/ holds the brainstorm companion's
  // untracked files; coverage/ holds Vitest's generated report; dist/ holds
  // the web app's build; e2e/playwright-report/ and e2e/test-results/ hold
  // Playwright's output.
  globalIgnores([
    "docs/",
    ".superpowers/",
    "coverage/",
    "**/dist/",
    "e2e/playwright-report/",
    "e2e/test-results/",
  ]),
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        // Lint each file with the tsconfig that includes it, looked up from
        // this folder.
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  // The rules of hooks for the SPA (ADR 0005, decision 12).
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    extends: [reactHooks.configs.flat.recommended],
  },
  // Journeys import test and expect from e2e/support/test.ts, which adds the
  // CSP guard: one importing @playwright/test would run unguarded and still
  // pass (ADR 0026, decision 7).
  {
    files: ["e2e/tests/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@playwright/test",
              message:
                "Import test and expect from ../support/test.ts, which adds the CSP guard.",
            },
          ],
        },
      ],
    },
  },
  // The landing page's scripts and the web app's script in public/ run in
  // the browser. no-undef knows no browser globals here, and tsc's checkJs
  // (lib: dom) already reports a name that is not defined.
  {
    files: ["apps/landing/**/*.js", "apps/web/public/**/*.js"],
    rules: { "no-undef": "off" },
  },
  // The web app's public/ scripts are copied as they are, so no tsconfig.json
  // can sit next to them; tsc checks them through tsconfig.public.json, and
  // ESLint lints them without type information.
  {
    files: ["apps/web/public/**/*.js"],
    extends: [tseslint.configs.disableTypeChecked],
  },
  // Last: turns off the rules that would fight Prettier.
  prettier,
);
