// Checks every commit message (the commit-msg hook in .husky/).
// Conventional Commits, ADR 0009, decision 9; the scope list, ADR 0016.
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Dependabot's bodies and our Claude-Session trailer hold long links.
    "body-max-line-length": [0],
    "footer-max-line-length": [0],
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "docs",
        "test",
        "refactor",
        "perf",
        "build",
        "ci",
        "chore",
      ],
    ],
    // The scope is optional; when given, it must be one of these.
    // A PR that needs a new scope adds it here.
    "scope-enum": [
      2,
      "always",
      [
        // Workspaces and test layers
        "web",
        "api",
        "shared",
        "e2e",
        // Features: one per requirement area
        "accounts",
        "lists",
        "items",
        "ordering",
        "categories",
        "catalog",
        "units",
        "templates",
        "sharing",
        "sync",
        "limits",
        "connectivity",
        // Docs
        "adr",
        "spec",
        "plan",
        "requirements",
        "audit",
        "roadmap",
        // Tooling
        "infra",
        "deps",
        "main",
        "claude",
      ],
    ],
  },
};
