# commitlint

commitlint checks every commit message against the Conventional Commits convention (`type(scope): description`), in the `commit-msg` git hook. A message that breaks the rules stops the commit before it exists.

## Why Szop uses it

- **Conventional Commits, checked by a tool:** [ADR 0009](../../decisions/0009-git-workflow.md), decision 9. release-please reads the commit types to pick the next version, so a convention nobody checks would silently drift. Plain imperative subjects would give tools nothing to read.
- **In a hook, then in CI:** decision 16 of the same ADR puts commitlint and the `commit-msg` hook in the development environment phase, since both need `package.json` and husky. From PH-02, CI checks every commit of a pull request too, so skipping the hook only delays the failure.
- **The preset, with two changes** ([OP-009](../../open-points.md#op-009)): the line-length limits on bodies and footers are off, since Dependabot's commit bodies hold links longer than 100 characters, which would fail every Dependabot PR; and only the nine types of ADR 0009 are allowed, not the preset's `style` and `revert`.
- **A scope allow-list:** a misspelled scope (`feat(aip)`) would otherwise pass and split the history. [ADR 0016](../../decisions/0016-toolchain-details.md) explains the list.

## Configuration

**`commitlint.config.js`** extends `@commitlint/config-conventional`, the preset with the usual Conventional Commits rules, and overrides these rules. A rule is written `[level, "always", value]`: level `2` means an error, `0` means off. A rule that is off needs only its level, so `[0]` is enough.

- `"body-max-line-length": [0]` and `"footer-max-line-length": [0]`: no line-length limit in the body or footer, for the long links above and our `Claude-Session` trailer.
- `"type-enum"`: the type must be one of `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `build`, `ci`, `chore`.
- `"scope-enum"`: when a scope is given, it must be one of the list, grouped in the file by comment: workspaces and test layers, one feature per requirement area, docs, tooling. A commit without a scope is fine. The list also carries `deps-dev`, Dependabot's own scope for a devDependency (it writes `build(deps-dev): …`, and `build(deps): …` for a production dependency), which cannot be renamed ([ADR 0018](../../decisions/0018-ci-details.md), decision 8).

**Why the scope is optional, and how to combine scopes:** the preset sets no `scope-empty` rule, which is the rule that would demand a scope, and `scope-enum` passes when there is no scope. One scope slot may also hold several allow-listed values, separated by `/`, `\` or `,` (a comma may be followed by one space): `feat(web,api): …`, `feat(web/api): …` and `feat(web, api): …` all pass. Each part must be on the list, so `feat(web,aip)` fails.

**Adding a scope:** a pull request that needs a new scope adds it to the `scope-enum` list in the same PR, in the group it belongs to. The rule then accepts it from that commit on.

**Merge commits** (`Merge branch 'main' into …`) are ignored by commitlint's default ignore rules, so bringing `main` into a branch passes without a type. The same goes for the messages git writes for a revert (`Revert "feat: add thing"`).

**Rules the preset keeps:** the overrides above leave the rest of `@commitlint/config-conventional` in force, and two of its rules reject messages in everyday use:

- `subject-case`: the subject must not be in sentence case, start case, Pascal case or upper case. `feat: Add thing` and `docs(adr): ADR 0016` are rejected, `feat: add thing` passes.
- `header-max-length`: the first line, `type(scope): subject`, is at most 100 characters.

**`.husky/commit-msg`** holds one line, `pnpm exec commitlint --edit "$1"`. Git passes the path of the file holding the message as the first argument (`$1`), and `--edit` tells commitlint to read the message from it. A non-zero exit stops the commit. See [husky and lint-staged](husky-and-lint-staged.md) for how the hook runs.

## Everyday use

When the message breaks a rule, git prints each problem with the name of the rule in brackets, for example `✖ scope must be one of [...] [scope-enum]`, followed by `husky - commit-msg script failed`, and creates no commit. Git keeps the message you wrote, so fix it without retyping:

```bash
git commit -e -F .git/COMMIT_EDITMSG    # reopen the rejected message in the editor, then commit again
echo "feat(api): add health check" | pnpm exec commitlint    # check a message without committing; exit 0 means it passes
```

- The rule name tells what to change: `type-enum` (use one of the nine types), `scope-enum` (use a listed scope or none), `subject-case` (start the subject in lower case, so `feat: add thing`), `header-max-length` (shorten the first line to 100 characters), `subject-empty` and `type-empty` (the subject must look like `type: description`).
- CI runs commitlint on every commit of a PR (the `commits` job) and on the PR title (`pr-title`), so a commit made with `--no-verify` is still caught; see [CI/CD](../ci-cd.md).

## Official documentation

- commitlint: <https://commitlint.js.org/>
- Rules reference: <https://commitlint.js.org/reference/rules.html>
- Conventional Commits: <https://www.conventionalcommits.org/>
