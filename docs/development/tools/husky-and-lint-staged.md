# husky and lint-staged

husky installs **git hooks** (see the [glossary](../../glossary.md)) from files kept in the repository, so every clone runs the same ones. lint-staged runs commands on the staged files only, the files about to be committed. Together they lint and format every commit before it exists.

## Why Szop uses them

- **A pre-commit hook, rather than lefthook or CI only:** [ADR 0005](../../decisions/0005-development-environment.md), decision 13. Claude Code edits files outside the editor, so "format on save" never runs on its changes; a hook catches every commit, whoever makes it. lefthook is faster but less common. Without hooks, problems are caught only after a push.
- **Only formatting and linting:** type checks and tests are slow and cover the whole project, so they stay in CI. lint-staged keeps the hook fast by touching only the staged files.

## Configuration

**`package.json`** has `"prepare": "husky"`. pnpm runs the `prepare` script after every full `pnpm install`, and `husky` sets the git setting `core.hooksPath` to `.husky/_`. From then on, git looks for its hooks in that folder, and the small scripts husky generates there call the ones in `.husky/`. The folder `.husky/_` is generated and ignored by git.

**`.husky/pre-commit`** holds one line, `pnpm exec lint-staged`, which git runs before it creates a commit. A non-zero exit stops the commit. `.husky/commit-msg`, which checks the commit message, is added with commitlint (see [commitlint](commitlint.md)).

**`lint-staged.config.js`** maps a file pattern to the commands run on the staged files that match:

- The comment on top says where the file is used: the pre-commit hook.
- `"*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}"`: the code files. The glob lists every type ESLint lints, so a phase that adds `.tsx` files is covered without anyone remembering to extend it.
- `"eslint --fix --max-warnings=0 --no-warn-ignored"`: applies the fixes ESLint can make itself, then fails on any remaining finding, warnings included, so nothing is merely tolerated. `--no-warn-ignored` is there because ESLint would otherwise warn about a staged file its config ignores, such as one under `docs/`, and `--max-warnings=0` would turn that warning into a failed commit. See [ESLint](eslint.md).
- `"prettier --write"`: formats the same files. It runs after ESLint so the final layout is Prettier's. See [Prettier](prettier.md).
- `"!(*.{ts,tsx,mts,cts,js,jsx,mjs,cjs})"`: every other staged file.
- `"prettier --write --ignore-unknown"`: formats whatever Prettier knows (JSON, YAML, CSS and so on), honours `.prettierignore` (so Markdown is left alone) and skips file types Prettier does not know instead of failing on them.

## Everyday use

On `git commit`, the hook runs lint-staged, which runs the commands above on the staged files only and stages the result.

- If every command passes, the commit goes ahead. Files the hook reformatted are staged again automatically, so the commit holds the formatted version.
- If a command fails, for example on an ESLint finding it cannot fix, git prints the finding followed by `husky - pre-commit script failed` and creates no commit. Fix the file, stage it and commit again.
- `git commit --no-verify` skips the hooks. It exists for emergencies, but from PH-02 CI runs the same checks, so skipping only delays the failure to the pull request.
- After cloning the repository, `pnpm install` sets the hooks up through the `prepare` script. Nothing else is needed.

```bash
pnpm exec lint-staged    # run the hook's checks on the staged files without committing
```

## Official documentation

- husky: <https://typicode.github.io/husky/>
- lint-staged: <https://github.com/lint-staged/lint-staged#readme>
