# PH-34 Landing page and demo status: design

The spec of [PH-34](../../roadmap.md#ph-34-landing-page-and-demo-status). The decisions it settles go into an ADR written in the phase; this document holds the design they were taken from.

## Contents

- [Goal](#goal)
- [Changes to the roadmap's entry](#changes-to-the-roadmaps-entry)
- [Decisions](#decisions)
- [Design](#design)
  - [Hosting and deployment](#hosting-and-deployment)
  - [DNS](#dns)
  - [The page](#the-page)
  - [The status check](#the-status-check)
- [Tests](#tests)
- [Definition of done for this phase](#definition-of-done-for-this-phase)
- [Order of work and the owner's steps](#order-of-work-and-the-owners-steps)
- [Risks](#risks)
- [Out of scope](#out-of-scope)

## Goal

`dzwoniec.com` serves a small static page: a picture of the _dzwoniec_ (the greenfinch), a short text about it, and, at the bottom, a link to Szop with a dot that shows whether the demo is up. The owner wants it simple and is not looking for new territory, so the page is hosted on GitHub Pages.

## Changes to the roadmap's entry

The brainstorm dropped one part of the entry, **the redirect of `szop.dzwoniec.com` to the page while the demo is down**. [ADR 0030](../../decisions/0030-domain-and-base-infrastructure-details.md), decision 13, and [OP-092](https://github.com/luiki-dev/szop/issues/202) had planned it. GitHub Pages cannot answer for a second domain, and Route 53 cannot redirect. Doing it needed either a second Pages repository or CloudFront with a function, plus a way to hand the `szop` record back to a fallback on `demo-down`. The owner chose to leave `szop.dzwoniec.com` as it is: it resolves only while the demo runs. `infra/demo`, `demo-down` and the deploy role do not change.

The roadmap entry, the phase issue and the owner-step issues are rewritten to match when the plan is committed.

## Decisions

| # | Decision | Alternatives considered | Why |
|---|---|---|---|
| 1 | The page is hosted on **GitHub Pages**, deployed by a GitHub Actions workflow. | S3 + CloudFront; a second Pages repository for the redirect. | The owner wants it simple. No AWS resources besides DNS records, no cost. |
| 2 | **No redirect** from `szop.dzwoniec.com`. | A second Pages repository; CloudFront with a function; Route 53 failover with a health check. | See the previous section. Settles OP-092 differently from ADR 0030. |
| 3 | The apex CAA record allows **`letsencrypt.org`** besides `amazon.com`; a CAA record on `szop.dzwoniec.com` keeps that name to `amazon.com`. | ACM certificate for the apex. | Pages issues its own certificate through Let's Encrypt and accepts no other. ACM public certificates work only inside AWS services. The record on `szop` keeps the app's name with Amazon, as ADR 0030, decision 6 decided. |
| 4 | **The page and its script are plain HTML, CSS and JavaScript**, in `apps/landing/`, with no build. | A framework or a bundler. | One page. A build step would be the only moving part. |
| 5 | The status check is a **`no-cors` `fetch`** of `https://szop.dzwoniec.com/api/health`; the application does not change. | CORS headers on the health endpoint, which would show the status code. | Any answer means up, a network error means down. A `503` from the load balancer while tasks start counts as up, which is accepted. |
| 6 | The status is checked on load and **every 30 seconds while the tab is visible**. | On load only. | `demo-up` takes minutes; an open page corrects itself. |
| 7 | **The "Szop" link is always a link.** | Plain text while the demo is down. | One state less. The grey dot already says the demo is down. |
| 8 | **The domain is verified** for the owner's GitHub account with a TXT record. | No verification. | Stops another repository from claiming `dzwoniec.com` on Pages. |
| 9 | **No end-to-end test** for the page. | A Playwright test with the health request intercepted. | The owner decided it is not worth a layer for one page; the logic is unit-tested and the page is checked once on the real domain. |

## Design

### Hosting and deployment

- The source is `apps/landing/`: `index.html`, `style.css`, `status.js`, the picture, and a favicon if the owner wants one.
- The workflow `.github/workflows/pages.yml` runs on a push to `main` that changes `apps/landing/**`, and by hand. While the phase is open it also runs on pushes to `feat/landing-page`, so the first deployment comes before the merge (a manual run needs the workflow on the default branch, a push does not); the last task removes that trigger. It uploads the folder with `actions/upload-pages-artifact` and deploys it with `actions/deploy-pages` to the `github-pages` environment. Actions are pinned by commit hash, like the other workflows.
- The Pages source is set to _GitHub Actions_ and the custom domain to `dzwoniec.com` in the repository settings (an owner step). There is no `CNAME` file.
- GitHub Pages cannot set response headers, so the Content Security Policy goes in a `<meta http-equiv>` tag: `default-src 'self'; connect-src https://szop.dzwoniec.com`. Nothing is loaded from elsewhere: no external scripts, fonts or analytics.
- `ci.yml` needs no change: `changes` already treats every file that is not Markdown as code and everything under `.github/workflows/` as workflows, so a change to the page runs the repository's checks for HTML, CSS and JavaScript, and `ci-ok` waits for them.

### DNS

All in `infra/base/dns.tf`, next to the existing records, so `infra/base` stays the only owner of the apex.

- **A and AAAA** for the apex: GitHub Pages' addresses, which are taken from GitHub's documentation when the plan is written.
- **CNAME `www`** to `luiki-dev.github.io`. Pages redirects `www` to the apex.
- **TXT `_github-pages-challenge-luiki-dev`**: the verification value, which GitHub issues. It is a constant in `locals.tf`: GitHub issues it and it is public in DNS.
- **CAA**: the apex record lists `amazon.com` and `letsencrypt.org`; a new record on `szop.dzwoniec.com` lists only `amazon.com`. A CAA record on a name takes precedence over its parent's, and the `szop` name carries an A record only while the demo runs, so the two do not conflict.
- The deploy role's scope is unchanged: `infra/demo` touches none of these records.

### The page

- One column, centred: the picture (with alternative text), the owner's text below it (English, written by the owner), and the footer with the link and the dot.
- **The page is paper.** The picture is a coloured-pencil drawing on paper, so the page's background is the colour of the picture's edges (`#fbf8f2`, sampled from the file) and a soft mask fades the picture into it. There is **no dark scheme**: the paper is the design. The page uses neither the application's `fur` background nor its sage accent, and shares no code with the application; it keeps [the design system's](../../architecture/visual-design.md) typeface, Gabarito (the 34 KB Latin file, self-hosted with its licence), and its rule that every text pair meets 4.5:1 and every UI part 3:1.
- **Layout:** the picture at its real size (600 × 600, scaled down on a narrow screen) in the middle of the page, the text under it in one paragraph (the species name in bold and dark, the rest lighter), and the footer at the bottom. The picture and its text are centred as one block. The picture is drawn onto the paper when the page loads (a 0.9 s fade and rise), and not at all when the system asks for reduced motion.
- **The approved mockups** are screenshots of the page with both dot states, in [the folder next to this spec](2026-10-23-PH-34-landing-page-and-demo-status/): [desktop, demo up](2026-10-23-PH-34-landing-page-and-demo-status/desktop-up.png), [desktop, demo down](2026-10-23-PH-34-landing-page-and-demo-status/desktop-down.png), [phone, demo up](2026-10-23-PH-34-landing-page-and-demo-status/phone-up.png) and [phone, demo down](2026-10-23-PH-34-landing-page-and-demo-status/phone-down.png).

### The status check

The check has two files: `check-demo.js` holds `checkDemo(fetch, url, timeoutMs)`, which returns `"up"` or `"down"` and is what the tests import, and `status.js` holds the few lines that call it and update the page.

- `checkDemo` calls `fetch(url, { mode: "no-cors", cache: "no-store", signal: AbortSignal.timeout(timeoutMs) })`. A resolved promise means `"up"`; a rejection (no DNS, no connection, a timeout) means `"down"`.
- Until the first answer the link has no dot. Without JavaScript only the link shows.
- **The dot** is the size of a capital "O". Up is a **filled green** dot, down is a **grey ring** (an outline, no fill), so the two differ by more than colour. A visually hidden text, "Szop demo is up" or "Szop demo is down", is read by screen readers, and the dot has a `title` for pointers.
- A timer repeats the check every 30 seconds while `document.visibilityState` is `"visible"`, and the page checks again when the tab becomes visible.

## Tests

- **Unit tests (Vitest)** for `checkDemo` with a fake `fetch`: a response gives `"up"`, a rejection gives `"down"`, and a request that outlives the timeout gives `"down"`. The function lives in `check-demo.js`, which `status.js` and the tests import.
- **The repository's linting and formatting** for the new HTML, CSS and JavaScript.
- **`terraform validate`, the plan and the scanners** that CI already runs on `infra/base`.
- **A manual check on the real domain** by the owner: HTTPS works, `www` redirects, the dot is grey with the demo down and green with it up (the owner's decision whether to use a demo session for the green case, see below).
- No end-to-end test (decision 9).

## Definition of done for this phase

From [the checklist](../../development/definition-of-done.md):

- **Item 4, deployed and checked:** the page is not part of the demo's image or `infra/demo`. The proposal is `➖ N/A: the page is not part of the demo; checked on dzwoniec.com`. The green dot is seen if the owner runs `demo-up` for another reason, or by pointing the page at a running demo; the owner decides.
- **Item 5, `infra/base` applied from the branch:** applies. This is the first owner step, which is why the Terraform task comes first.
- **Item 6, 7 and 8:** the ADR (decisions 1 to 9 above; it also notes ADR 0030, decision 13, as refined in the three places the repository asks for), the roadmap, `aws-resources.md`, `threat-model.md` (a public page on third-party hosting, and domain takeover with its guard, the verification record), `github-settings.md` (the Pages settings and the `github-pages` environment), `ci-cd.md` (the workflow), the runbook, `stack-overview.md` (static hosting, CAA, why `no-cors` can only tell "an answer" from "none"), `glossary.md`, and `scripts.md` if a script is added.
- **Item 9:** OP-092 ([#202](https://github.com/luiki-dev/szop/issues/202)) is closed with a "settled by" comment that says the redirect was dropped. The owner-step issue ([#206](https://github.com/luiki-dev/szop/issues/206)) is rewritten for the new steps.
- **Item 11:** screenshots of the page in the PR (phone in light and dark mode, desktop in light mode).

## Order of work and the owner's steps

The owner wants their steps done as early as possible, so that the certificate is issued while the rest is built. The plan starts with the DNS and the workflow, not with the page.

1. **Terraform** (`infra/base`): the records above, with the verification value as a variable. Opened for the owner to apply from the branch.
2. **Workflow and a placeholder page**: `apps/landing/` with a minimal `index.html` and `pages.yml`, so Pages has something to serve when the domain is added.
3. The page itself.
4. The status check and its unit tests.
5. Documentation and tracking.

The owner's steps, in order (details are verified against GitHub's documentation when the plan is written):

1. Add `dzwoniec.com` as a verified domain in the account's Pages settings, and copy the TXT value.
2. Apply `infra/base` from the branch with that value.
3. Enable Pages with the source _GitHub Actions_, allow the branch in the `github-pages` environment's deployment rules so the branch can deploy, and set the custom domain. The first deployment comes from the branch with the placeholder page.
4. Wait for the certificate, then switch on _Enforce HTTPS_.
5. After the merge: apply `infra/base` from `main`, and restore the environment's rule that only `main` deploys.

## Risks

- **The certificate can take a while** after the domain is set; the order of work is built around it.
- **GitHub's addresses can change.** They are taken from the documentation at plan time and listed in the ADR with the link.
- **`no-cors` hides the status code**, so a `503` during rollout shows as up (decision 5).
- **The environment's branch rule** is loosened for the first deployment and must be restored; the runbook lists it as a step.

## Out of scope

- A redirect from `szop.dzwoniec.com` (decision 2).
- A "last seen up" time or any stored state.
- Analytics, a contact form, or any further page.
