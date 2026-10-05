// @ts-check
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default defineConfig(
  // Docs hold no code; .superpowers/ holds the brainstorm companion's
  // untracked files; coverage/ holds Vitest's generated report.
  globalIgnores(["docs/", ".superpowers/", "coverage/"]),
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
  // Last: turns off the rules that would fight Prettier.
  prettier,
);
