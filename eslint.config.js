// @ts-check
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default defineConfig(
  // Docs hold no code; .superpowers/ holds the brainstorm companion's
  // untracked files.
  globalIgnores(["docs/", ".superpowers/"]),
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        // Lint each file with the tsconfig that includes it.
        projectService: true,
      },
    },
  },
  {
    // node:test's test() returns a promise the runner itself awaits.
    // Goes away when the tests move to Vitest in PH-03 (OP-062).
    files: [".claude/hooks/**/*.test.ts"],
    rules: {
      "@typescript-eslint/no-floating-promises": [
        "error",
        {
          allowForKnownSafeCalls: [
            { from: "package", package: "node:test", name: ["test"] },
          ],
        },
      ],
    },
  },
  // Last: turns off the rules that would fight Prettier.
  prettier,
);
