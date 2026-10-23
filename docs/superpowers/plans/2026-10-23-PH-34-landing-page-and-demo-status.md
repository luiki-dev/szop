# PH-34 Landing page and demo status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `dzwoniec.com` serves a small static page, hosted on GitHub Pages, with the greenfinch's picture, a short text and a footer link to Szop whose dot shows whether the demo is up.

**Architecture:** The page is plain HTML, CSS and JavaScript in `apps/landing/`, deployed by `pages.yml` to GitHub Pages. `infra/base` gains the DNS records Pages needs and the CAA changes that let Let's Encrypt issue its certificate. A `no-cors` `fetch` of `https://szop.dzwoniec.com/api/health` tells "an answer" from "none"; the application does not change.

**Tech Stack:** GitHub Pages and Actions (`actions/upload-pages-artifact`, `actions/deploy-pages`), Terraform (Route 53), plain HTML, CSS and ES modules, Vitest.

**Spec:** [`docs/superpowers/specs/2026-10-23-PH-34-landing-page-and-demo-status-design.md`](../specs/2026-10-23-PH-34-landing-page-and-demo-status-design.md)

## Global Constraints

- The page is **plain HTML, CSS and JavaScript with no build**, in `apps/landing/`. It is not a pnpm workspace package (no `package.json`, no lockfile change, no Dockerfile change).
- No end-to-end test (spec, decision 9). The status logic has unit tests; the rest is checked by hand and the checks are listed in the tasks.
- The status check is `fetch("https://szop.dzwoniec.com/api/health", { mode: "no-cors", cache: "no-store", signal: AbortSignal.timeout(5000) })`; any answer is `"up"`, any rejection is `"down"`. It repeats every **30 seconds** while the tab is visible. The application is not changed.
- The dot is the size of a capital "O": **up** a filled green dot, **down** a grey ring (outline, no fill). A visually hidden text, "Szop demo is up" or "Szop demo is down", and a `title` say the same. The "Szop" link is always a link.
- The Content Security Policy is a `<meta http-equiv>` tag: `default-src 'self'; connect-src https://szop.dzwoniec.com; base-uri 'none'; form-action 'none'`. Nothing is loaded from elsewhere. No inline scripts or styles.
- Page language English. The text under the picture is the owner's, written by them.
- DNS: the apex A and AAAA are GitHub Pages' addresses, `www` is a CNAME to `luiki-dev.github.io`, the verification TXT is `_github-pages-challenge-luiki-dev.dzwoniec.com`, the apex CAA allows `amazon.com` and `letsencrypt.org`, and `szop.dzwoniec.com` has a CAA allowing `amazon.com` only.
- `infra/demo`, `demo-down` and the deploy role do not change.
- `pnpm check` passes after every code task; `pnpm check:workflows` after every workflow change; `pnpm check:infra` and `pnpm check:scan` after every `infra/` change.
- Never run `terraform apply` or `destroy`, never `gh workflow run`, never trigger `demo-up` or `demo-down`, never merge, never delete a remote branch.
- Nothing that identifies the owner's account goes into a commit: no account ID, no ARN with the account number, no email address.
- Commits follow Conventional Commits and end with `Co-Authored-By: <the model that wrote the commit> <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01MTbba5oE5uuazNB6HHP8a1`. The branch is `feat/landing-page`; never commit to `main`.
- Docs: niche acronyms spelled out on first use and in `docs/glossary.md`; every status with its icon; requirements linked, never plain IDs; long docs keep their `## Contents` in sync; ADR notes in three places (CLAUDE.md, "Documentation").
- **After each task:** tick its step boxes (`- [ ]` → `- [x]`) in this plan within the task's own commit, `git push` the phase branch, then stop and summarize the task for the owner; start the next task only when the owner says so (`docs/superpowers/plans/CLAUDE.md`).

## Review Focus

1. **A script that never answers.** A host that accepts the connection and then hangs must end as `"down"` after the timeout, not leave the footer without a state for good. Task 4 tests a `fetch` that settles only when its signal aborts.
2. **The page's own CSP blocking the page.** A policy too tight silently kills the check (the fetch is refused, the dot turns grey while the demo is up) or the styles. Task 3 and Task 4 load the page in Chromium and fail on any console message about a policy violation.
3. **JavaScript off or the script failing to load.** The footer must still show the working "Szop" link, with no half-drawn dot. Task 4 loads the page with JavaScript disabled.
4. **A `503` or any HTTP error from the demo.** `no-cors` hides the status, so the answer counts as up. Task 4's test passes an opaque response and expects `"up"`; the stack overview says why (Task 5).
5. **`www` and plain `http://`.** `https://www.dzwoniec.com` and `http://dzwoniec.com` must end on `https://dzwoniec.com`. A `www` CNAME makes the CAA lookup follow GitHub's side, so a certificate problem for `www` starts there. Task 2's owner checks cover both.

---

## File Structure

| File | Responsibility |
|---|---|
| `infra/base/dns.tf`, `infra/base/locals.tf` | The Pages records, the verification TXT and the CAA changes |
| `.github/workflows/pages.yml` (new) | Builds nothing: uploads `apps/landing/` and deploys it to Pages |
| `apps/landing/index.html` (new) | The page: picture, text, footer, the CSP |
| `apps/landing/style.css` (new) | Layout, colours and typography from the design tokens, light and dark, the dot |
| `apps/landing/check-demo.js` (new) | `checkDemo`, the pure status function the tests import |
| `apps/landing/status.js` (new) | Wires `checkDemo` to the page and repeats it |
| `apps/landing/check-demo.test.js` (new) | Unit tests of `checkDemo` |
| `apps/landing/tsconfig.json` (new) | Type-checks the page's JavaScript (`checkJs`) and lets ESLint's type-aware rules read it |
| `vitest.config.ts`, `package.json` | A `landing` test project; `typecheck` also checks `apps/landing` |
| `.dockerignore` | `apps/landing`, so the page never invalidates the image's layers |
| Docs | Per task; Task 5 holds the ADR and the rest |

---

### Task 1: DNS records and CAA in `infra/base`

**Files:**
- Modify: `infra/base/dns.tf`, `infra/base/locals.tf`, `docs/architecture/aws-resources.md`, `docs/superpowers/specs/2026-10-23-PH-34-landing-page-and-demo-status-design.md`

**Interfaces:**
- Produces: Route 53 records for the apex (A, AAAA), `www` (CNAME), `_github-pages-challenge-luiki-dev` (TXT) and `szop` (CAA); the apex CAA with two authorities. A local `github_pages_challenge` holds the verification value.

- [x] **Step 1: Get the verification value**

The owner's step 1 (spec, "Order of work"): add `dzwoniec.com` as a verified domain in the account's Pages settings (GitHub → Settings → Pages → _Add a domain_) and copy the value of the TXT record GitHub shows. It is public in DNS once applied. If the value is not in the conversation, stop and ask for it before the next step.

- [x] **Step 2: Add the value and the records**

In `locals.tf`, `github_pages_challenge = "<value>"`, with a comment saying what it is and that GitHub issues it. In `dns.tf` add, in the style of the existing records (`zone_id = aws_route53_zone.main.zone_id`, `ttl = 3600`, a comment on each saying why it exists):
- `aws_route53_record.pages_a`: apex, `A`, `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
- `aws_route53_record.pages_aaaa`: apex, `AAAA`, `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`.
- `aws_route53_record.pages_www`: `www.${local.domain}`, `CNAME`, `luiki-dev.github.io`.
- `aws_route53_record.pages_challenge`: `_github-pages-challenge-luiki-dev.${local.domain}`, `TXT`, `local.github_pages_challenge`.
- `aws_route53_record.caa_app`: `local.app_hostname`, `CAA`, `0 issue "amazon.com"`, with a comment that it keeps the app's name with Amazon (ADR 0030, decision 6) now that the apex also allows Let's Encrypt.

Before relying on the addresses, compare both lists with [GitHub's documentation of custom domains](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site) and correct them if GitHub's differ.

- [x] **Step 3: Allow Let's Encrypt at the apex**

Change `aws_route53_record.caa`'s `records` to `["0 issue \"amazon.com\"", "0 issue \"letsencrypt.org\""]` and rewrite its comment: Amazon's authority issues the app's certificates, and Let's Encrypt is there because GitHub Pages obtains the page's certificate from it (ADR 0044, written in Task 5); `szop` has its own record below.

- [x] **Step 4: Check**

Run: `pnpm check:infra` and `pnpm check:scan`
Expected: both pass (format, validate, tflint; no new blocking finding).

- [x] **Step 5: Docs**

`aws-resources.md`: add the new records to the Base diagram's Route 53 group and their rows to its table (the existing DKIM, CAA and MX boxes show the shape), and mention the CAA change. In the spec, replace "It is a Terraform variable the owner sets, like the other values that live outside the code." with "It is a constant in `locals.tf`: GitHub issues it and it is public in DNS."

- [x] **Step 6: Commit and push**

```bash
git add infra docs
git commit -m "feat(infra): add GitHub Pages records and CAA for dzwoniec.com"
git push
```

Then stop. **Owner:** run `terraform plan` in `infra/base` from the branch and check that it shows exactly five additions (`pages_a`, `pages_aaaa`, `pages_www`, `pages_challenge`, `caa_app`) and one change in place (`caa`), then apply. Nothing else may change.

---

### Task 2: The Pages workflow and a placeholder page

**Files:**
- Create: `.github/workflows/pages.yml`, `apps/landing/index.html`
- Modify: `.dockerignore`, `docs/development/ci-cd.md`, `docs/development/github-settings.md`, `docs/superpowers/specs/2026-10-23-PH-34-landing-page-and-demo-status-design.md`

**Interfaces:**
- Produces: the workflow `pages`, with job `build` (`contents: read`; uploads `apps/landing`) and job `deploy` (`pages: write`, `id-token: write`; `environment: github-pages`). Later tasks only change files in `apps/landing/`, which redeploys the page.

- [x] **Step 1: Pin the actions**

Resolve the commit of the newest release of `actions/upload-pages-artifact` and `actions/deploy-pages` that is at least a week old (the Dependabot cooldown), as an annotated tag's commit: `git ls-remote --tags https://github.com/actions/deploy-pages 'refs/tags/v5*'` (the `^{}` line, where there is one, is the commit). Candidates: `upload-pages-artifact` v5.0.0 `fc324d3547104276b827a68afc52ff2a11cc49c9`, `deploy-pages` v5.0.1 `368f82528645a54fb793d4d04e342629a3f51346`. `actions/checkout` is pinned as in the other workflows (`3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1`).

- [x] **Step 2: Write `pages.yml`**

Header comment in the style of the other workflows (what it does, ADR 0044, which environment). `on:` `push` to `main` and to `feat/landing-page`, paths `apps/landing/**` and `.github/workflows/pages.yml`; and `workflow_dispatch`. A comment marks the `feat/landing-page` trigger as **temporary: the first deployment comes from the branch, and Task 5 removes it**. `permissions: {}` at the top, `defaults: run: shell: bash`, `concurrency: group: pages, cancel-in-progress: false`. Job `build`: checkout (`persist-credentials: false`), `upload-pages-artifact` with `path: apps/landing`. Job `deploy`: `needs: build`, the two permissions, `environment: { name: github-pages, url: ${{ steps.deployment.outputs.page_url }} }`, `deploy-pages` with `id: deployment`. `timeout-minutes` on both jobs.

- [x] **Step 3: The placeholder and the Docker ignore**

`apps/landing/index.html`: a valid HTML5 page (`lang="en"`, charset, viewport, `<title>dzwoniec.com</title>`) whose body says the page is on its way. `.dockerignore`: add `apps/landing` under "Docs and tests: not run in the image" with a comment.

- [x] **Step 4: Check**

Run: `pnpm check:workflows` and `pnpm format:check`
Expected: no findings from actionlint or zizmor; Prettier passes.

- [x] **Step 5: Docs and spec**

`ci-cd.md`: describe `pages.yml` (trigger, jobs, permissions, why it is separate from `ci.yml`: the page deploys on `main` only). `github-settings.md`: the Pages settings (source _GitHub Actions_, custom domain `dzwoniec.com`, _Enforce HTTPS_) and the `github-pages` environment's deployment-branch rule with the temporary exception, each with why. In the spec's "Hosting and deployment": say the workflow also has a temporary trigger on `feat/landing-page` for the first deployment (a manual run needs the workflow on the default branch, a push does not), and replace the `ci.yml` bullet with "`ci.yml` needs no change: `changes` already treats every file that is not Markdown as code and everything under `.github/workflows/` as workflows."

- [x] **Step 6: Commit and push**

```bash
git add .github .dockerignore apps/landing docs
git commit -m "ci: deploy the landing page to GitHub Pages"
git push
```

The push runs `pages.yml`, which fails at `deploy` until the owner has done their steps; that is expected. Then stop. **Owner** (spec, "Order of work", steps 3 and 4, in this order):
1. Settings → Pages: source _GitHub Actions_, custom domain `dzwoniec.com`.
2. Settings → Environments → `github-pages`: add `feat/landing-page` to the allowed deployment branches.
3. Re-run the failed `pages` run, or push to `apps/landing/`. Wait for the certificate, then tick _Enforce HTTPS_.
4. Check `https://dzwoniec.com`, `https://www.dzwoniec.com` (ends on the apex) and `http://dzwoniec.com` (ends on HTTPS).

---

### Task 3: The page

**Files:**
- Create: `apps/landing/style.css`, `apps/landing/dzwoniec.<ext>` (the owner's picture), `docs/superpowers/specs/2026-10-23-PH-34-landing-page-and-demo-status/` (the approved mockups, phone and desktop)
- Modify: `apps/landing/index.html`

**Interfaces:**
- Produces: the markup Task 4 wires: in the footer, `<a id="szop-link" href="https://szop.dzwoniec.com">Szop</a>` followed by `<span id="demo-dot" class="dot"></span>` and `<span id="demo-text" class="sr-only"></span>`. Until the script runs, `#demo-dot` has no `data-state` and is not drawn. The CSP `<meta>` is already in the head.

- [x] **Step 1: Inputs and mockup**

Ask the owner for the text under the picture (English) and check that the picture is at `apps/landing/dzwoniec.<ext>`. Design the page as a mockup in the visual companion with the tokens of [the design system](../../architecture/visual-design.md) (the light page `fur`, text `gray-800`, dark `gray-900` and `gray-200`, the sage accent, Gabarito if it is wanted; spacing, size of the picture and the text's style are decided there). When the owner approves, commit screenshots of the mockup, phone and desktop, in the folder named above, and link them from the spec's "The page" section.

- [x] **Step 2: Build the page**

`index.html`: the picture (`<img>` with `width` and `height` attributes and descriptive `alt`), the text, the footer as in Interfaces. `style.css`: the tokens as custom properties, a dark scheme under `prefers-color-scheme: dark`, a `.sr-only` class, `.dot` hidden until it has `data-state` (Task 4 draws it). If the mockup uses Gabarito, copy its Latin variable font from `apps/web/node_modules/@fontsource-variable/gabarito/files/` into `apps/landing/fonts/` with its licence note, and load it with `@font-face` (`'self'` already allows it). CSP `<meta>` as in the Global Constraints.

- [x] **Step 3: Check it in a browser**

With a small Playwright script kept in the scratchpad, not committed, serve `apps/landing/` (any static server) and open it in Chromium at 390×844 in light and dark and at 1280×800 in light. Expected: matches the mockup; the console shows no message about a Content Security Policy violation. Keep the screenshots for the PR.

- [x] **Step 4: Check and commit**

Run: `pnpm check`
Expected: pass.

```bash
git add apps/landing docs
git commit -m "feat(landing): add the landing page"
git push
```

Stop. The push redeploys the page; the owner can look at `https://dzwoniec.com`.

---

### Task 4: The status check

**Files:**
- Create: `apps/landing/check-demo.js`, `apps/landing/check-demo.test.js`, `apps/landing/status.js`, `apps/landing/tsconfig.json`
- Modify: `apps/landing/index.html`, `apps/landing/style.css`, `vitest.config.ts`, `package.json`, `docs/development/testing.md`, `docs/superpowers/specs/2026-10-23-PH-34-landing-page-and-demo-status-design.md`

**Interfaces:**
- Produces: `export async function checkDemo(fetchFn: typeof fetch, url: string, timeoutMs: number): Promise<"up" | "down">` in `check-demo.js`. `status.js` imports it, and sets `data-state` (`"up"` or `"down"`) and `title` on `#demo-dot` and the text of `#demo-text`.
- Consumes: the footer markup of Task 3.

- [x] **Step 1: Tooling**

`apps/landing/tsconfig.json`: extends `../../tsconfig.base.json`, `noEmit`, `allowJs`, `checkJs`, `lib: ["es2024", "dom"]`, `include: ["*.js"]`, so ESLint's type-aware rules read these files. `vitest.config.ts`: a project `{ test: { name: "landing", environment: "node", include: ["apps/landing/**/*.test.js"] } }` next to `hooks`. `package.json`: `typecheck` becomes `tsc --noEmit && tsc --noEmit -p apps/landing && pnpm -r typecheck`.

- [x] **Step 2: Write the failing tests** in `check-demo.test.js`

With a fake `fetchFn` (a `vi.fn()`):
- `it("is up when the request is answered, whatever the answer")`: resolves with `{ type: "opaque" }`; expects `"up"`, and one call with the URL and an options object holding `mode: "no-cors"`, `cache: "no-store"` and a `signal` that is an `AbortSignal`.
- `it("is down when the request fails")`: rejects with `new TypeError("Failed to fetch")`; expects `"down"`.
- `it("is down when the request outlives the timeout")`: `timeoutMs` 20; the fake returns a promise that rejects with the signal's `reason` when the signal aborts and never settles otherwise; expects `"down"`.

- [x] **Step 3: Run them and see them fail**

Run: `pnpm vitest run --project landing`
Expected: FAIL, `check-demo.js` does not exist.

- [x] **Step 4: Implement `checkDemo`**

In `check-demo.js`: call `fetchFn(url, { mode: "no-cors", cache: "no-store", signal: AbortSignal.timeout(timeoutMs) })`; resolved is `"up"`, any rejection is `"down"`. A comment says why `no-cors` is enough and what it cannot tell.

- [x] **Step 5: Run them and see them pass**

Run: `pnpm vitest run --project landing`
Expected: 3 passed.

- [x] **Step 6: Wire the page**

`status.js` (loaded from `index.html` with `<script type="module" src="status.js">`): constants `HEALTH_URL` (`https://szop.dzwoniec.com/api/health`), `TIMEOUT_MS` 5000, `INTERVAL_MS` 30000. A function that runs one check unless one is in flight and applies the result to `#demo-dot` and `#demo-text` ("Szop demo is up" or "Szop demo is down", also as the dot's `title`). It runs on load, every `INTERVAL_MS` while `document.visibilityState` is `"visible"`, and when the tab becomes visible. `style.css`: `.dot[data-state]` draws a circle the height of a capital "O" (about `0.75em`), `up` filled green, `down` a grey ring with no fill; the colours come from the tokens and meet 3:1 against the page in both schemes (checked on the mockup's colours).

- [x] **Step 7: Check by hand**

Extend the scratchpad script: open the page with the health request fulfilled (expect the green dot and text "Szop demo is up"), aborted (expect the grey ring and "down"), and with JavaScript disabled (expect the "Szop" link and no dot). Fail on any console message about a policy violation in all three. Keep screenshots of the two states for the PR.

- [x] **Step 8: Docs and spec**

`testing.md`: the new `landing` project and what it covers. In the spec's "The status check", say that `checkDemo` is in `check-demo.js`, imported by the tests, and the few lines that call it are in `status.js`.

- [x] **Step 9: Check and commit**

Run: `pnpm check`
Expected: lint, format, typecheck and tests pass.

```bash
git add apps/landing vitest.config.ts package.json docs
git commit -m "feat(landing): show whether the demo is up"
git push
```

Stop. **Owner:** open `https://dzwoniec.com`; with the demo down the dot is a grey ring.

---

### Task 5: Documentation, tracking and the pull request

**Files:**
- Create: `docs/decisions/0044-landing-page-details.md`
- Modify: `docs/decisions/0030-domain-and-base-infrastructure-details.md`, `docs/roadmap.md`, `README.md`, `docs/architecture/threat-model.md`, `docs/architecture/stack-overview.md`, `docs/architecture/architecture.md`, `docs/glossary.md`, `docs/operations/demo-environment.md`, `.github/workflows/pages.yml`

- [x] **Step 1: The ADR**

`0044-landing-page-details.md`, shaped like [ADR 0041](../../decisions/0041-security-scanners-details.md), with the spec's nine decisions, their alternatives and reasons, and the consequences. Header: `Refines:` ADR 0030, decision 13 (the redirect is dropped; OP-092 is settled differently). Note it in the three places CLAUDE.md asks: ADR 0030's status line, and a `✏️ **Refined by [ADR 0044](0044-landing-page-details.md), decision 2:**` line at the bottom of decision 13's cell. Also note in ADR 0030's consequences that the CAA now names Let's Encrypt.

- [x] **Step 2: The living docs**

- `roadmap.md`: rewrite PH-34's entry (goal and delivers without the redirect, the owner steps of the spec, the plan link in its stage-table row, then the PR link when the PR opens) and update the README's diagram with it.
- `threat-model.md`: the page as a public entry point on third-party hosting; domain takeover and the verification record that guards against it; the CAA change.
- `stack-overview.md`: static hosting on GitHub Pages, what CAA is, why `no-cors` can tell "an answer" from "none" but not the status (and so a `503` counts as up).
- `architecture.md`: the landing page among the components.
- `glossary.md`: CAA, Let's Encrypt, GitHub Pages and any other new term.
- `demo-environment.md`: a section for the landing page with the owner's steps, including restoring the `github-pages` environment to `main` only after the merge.

- [x] **Step 3: Remove the temporary trigger**

Only after the owner confirms that `https://dzwoniec.com` is served with HTTPS: remove `feat/landing-page` from `pages.yml`'s `push` branches and its comment, and run `pnpm check:workflows`.

- [x] **Step 4: Tracking on GitHub**

Close [#202](https://github.com/luiki-dev/szop/issues/202) (OP-092) as completed with the comment "settled by PH-34 and ADR 0044: the page is on GitHub Pages; the redirect was dropped". Rewrite [#206](https://github.com/luiki-dev/szop/issues/206) and add owner-step issues for the roadmap entry's new owner steps, as sub-issues of [#205](https://github.com/luiki-dev/szop/issues/205); update #205's body to match the roadmap entry. Anything the owner steps change in the Szop project's fields (Status, Spec, Plan) is the owner's.

- [x] **Step 5: Check, commit and push**

Run: `pnpm check` and `pnpm check:workflows`
Expected: pass.

```bash
git add docs README.md .github
git commit -m "docs: record PH-34's decisions and update the living docs"
git push
```

- [ ] **Step 6: Open the pull request**

Fill in `.github/pull_request_template.md`: title `feat(landing): serve a landing page with the demo's status`; links to the roadmap entry, spec, plan and ADR 0044; `Closes #205` and `Closes #202` on their own lines; the list of issue changes from Step 4; the screenshots of Tasks 3 and 4 (phone light and dark, desktop light); the definition of done: tests (unit tests, no end-to-end test by decision), CI after the push, **the demo check `➖ N/A: the page is not part of the demo; checked on dzwoniec.com`**, `infra/base` applied from the branch (owner; again from `main` after the merge), docs, ADR, open points, commits. Do not merge.

---

## Self-review

- **Spec coverage:** decisions 1 and 2 (Pages, no redirect): Tasks 2, 5; 3 (CAA): Task 1; 4 (plain files): Task 3; 5 and 6 (`no-cors`, 30 s): Task 4; 7 (always a link): Task 3; 8 (verification): Task 1; 9 (no end-to-end test): Global Constraints. The owner's steps follow the spec's order. The spec's "mockup committed next to the spec" is Task 3; screenshots for the PR are Tasks 3 and 4.
- **Spec changes:** the TXT is a constant in `locals.tf` (Task 1); the `ci.yml` bullet and the temporary branch trigger (Task 2); the two files for the status (Task 4). Each task edits the spec in its own commit.
- **Names:** `checkDemo`, `#szop-link`, `#demo-dot`, `#demo-text`, `data-state`, `pages.yml` are used the same way in every task.
