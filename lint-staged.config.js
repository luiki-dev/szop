// Runs on the staged files of every commit (the pre-commit hook in .husky/).
export default {
  // Every file type ESLint lints, so a new type (such as .tsx) is covered
  // without anyone remembering to add it here.
  "*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}": [
    "eslint --fix --max-warnings=0 --no-warn-ignored",
    "prettier --write",
  ],
  // Terraform files: the formatter Terraform ships with. Prettier skips
  // them below through --ignore-unknown.
  "*.tf": "terraform fmt",
  // Workflow files and the other YAML under .github/ (ADR 0032, decision 2).
  // actionlint checks the workflows; zizmor audits the workflows, the local
  // actions and dependabot.yml. Handed any other .github YAML alone (an issue
  // template, its own zizmor.yml), zizmor fails with "no inputs collected", so
  // it gets only what it audits. It finds .github/zizmor.yml by itself.
  ".github/**/*.{yml,yaml}": (/** @type {string[]} */ files) => {
    const quoted = (/** @type {string[]} */ list) =>
      list.map((file) => JSON.stringify(file)).join(" ");
    const workflows = files.filter((file) =>
      file.includes("/.github/workflows/"),
    );
    const audited = files.filter((file) =>
      /\/\.github\/(workflows\/|actions\/|dependabot\.ya?ml$)/.test(file),
    );
    return [
      ...(workflows.length > 0 ? [`actionlint ${quoted(workflows)}`] : []),
      ...(audited.length > 0 ? [`zizmor --offline ${quoted(audited)}`] : []),
    ];
  },
  // Everything else Prettier knows. It honours .prettierignore (Markdown).
  "!(*.{ts,tsx,mts,cts,js,jsx,mjs,cjs})": "prettier --write --ignore-unknown",
};
