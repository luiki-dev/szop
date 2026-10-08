// @ts-check
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default defineConfig(
  // Docs hold no code; .superpowers/ holds the brainstorm companion's
  // untracked files; coverage/ holds Vitest's generated report; dist/ holds
  // the web app's build.
  globalIgnores(["docs/", ".superpowers/", "coverage/", "**/dist/"]),
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
  // Last: turns off the rules that would fight Prettier.
  prettier,
);
