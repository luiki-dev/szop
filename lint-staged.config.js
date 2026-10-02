// Runs on the staged files of every commit (the pre-commit hook in .husky/).
export default {
  // Every file type ESLint lints, so a new type (such as .tsx) is covered
  // without anyone remembering to add it here.
  "*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}": [
    "eslint --fix --max-warnings=0 --no-warn-ignored",
    "prettier --write",
  ],
  // Everything else Prettier knows. It honours .prettierignore (Markdown).
  "!(*.{ts,tsx,mts,cts,js,jsx,mjs,cjs})": "prettier --write --ignore-unknown",
};
