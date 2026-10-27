# CI run analysis — 2026-10-26

An analysis of how long Szop's GitHub Actions runs, jobs and steps take, and how often they run, done to find where CI spends its time before improving it. It covers every run from 2026-10-04 to 2026-10-26: 729 runs of 9 workflows.

This is a point-in-time report, not a living document. Its findings are the ones Claude gave the owner in the session of 2026-10-26, kept close to word for word. They led to [OP-108](https://github.com/luiki-dev/szop/issues/294) and to [PH-41](../roadmap.md#ph-41-faster-steadier-ci), which acts on them.

**The interactive page**, [`2026-10-26-ci-run-analysis/ci-runs.html`](2026-10-26-ci-run-analysis/ci-runs.html), shows the same data with a date range to narrow it. Open it in a browser from a checkout: GitHub shows an HTML file as source. [`collect.py`](2026-10-26-ci-run-analysis/collect.py) fetches the runs again and rewrites the page's data, so a later run can be compared with this one.

## Contents

- [Scope and method](#scope-and-method)
- [Workflows](#workflows)
- [CI by what it checked](#ci-by-what-it-checked)
- [CI jobs](#ci-jobs)
- [The steps that weigh the most](#the-steps-that-weigh-the-most)
- [Conclusions](#conclusions)

## Scope and method

- **Source:** the GitHub API, through `gh`: every run of every workflow, and the jobs and steps of each finished run's latest attempt.
- **Duration:** a successful run's span, from its first job's start to its last job's end. Queueing before the first job is left out; adding it changes the CI median by about 6 seconds.
- **Reruns** are left out of durations: a rerun keeps the passed jobs of its first attempt, so its span covers both attempts. The 4 reruns of CI spanned 17m21s to 33m58s.
- **Categories of CI runs** come from the jobs that ran, which change detection decides: *app* means the end-to-end job ran, *infra* the Terraform checks (`infra` or `plan`), *workflows* only the workflow linters, *docs only* none of them.

## Workflows

| Workflow | Runs | A day | Median | 90th pct. | Shortest | Longest |
|---|---|---|---|---|---|---|
| PR title | 216 | 10.0 | 18s | 22s | 11s | 1m07s |
| CI | 206 (172 ✅, 12 ❌, 22 ✖️ cancelled) | 9.5 | 1m26s | 2m36s | 16s | 10m41s |
| CodeQL | 201 | 9.3 | 55s | 1m14s | 38s | 1m30s |
| Dependabot Updates | 47 | 2.2 | 44s | 2m21s | 17s | 5m36s |
| demo-down | 20 (8 scheduled) | 0.9 | 1m28s | 9m36s | 22s | 9m57s |
| demo-up | 18 (15 ✅) | 0.8 | 12m05s | 24m13s | 3m41s | 49m41s |
| release-please | 12 | 0.6 | 26s | 2m23s | 16s | 3m49s |
| pages | 8 | 0.4 | 21s | 6m27s | 17s | 6m27s |

Cancelled CI runs are mostly a new push to the same branch cancelling the run before it.

## CI by what it checked

First attempts of successful runs:

| Category | Share | Median | 90th pct. | Shortest | Longest |
|---|---|---|---|---|---|
| PR: app + infra | 29% | 1m30s | 3m52s | 1m13s (PH-10) | 10m41s (PH-35) |
| PR: app, no infra | 19% | 2m06s | 2m58s | 1m14s (PH-12a) | 5m46s (a Dependabot npm update) |
| push to main: app + infra | 18% | 1m46s | 2m23s | 1m16s | 4m57s |
| PR: docs only | 14% | 23s | 51s | 16s | 1m12s |
| PR: workflows only | 7% | 34s | 48s | 27s | 1m07s |
| push to main: workflows only | 7% | 40s | 53s | 24s | 1m16s |
| push to main: app, no infra | 5% | 1m28s | 2m19s | 1m13s | 2m19s |
| PR: infra only | 1% | 1m00s | — | 1m00s | 1m00s |

The shortest CI run of all took 16s: a docs-only PR (`docs/open-points-parts-lists`). The longest, reruns aside, took 10m41s, on PH-35, where installing Playwright's browsers alone took 9m42s.

## CI jobs

Over the 172 successful runs:

| Job | Runs in | Median | 90th pct. | Max |
|---|---|---|---|---|
| e2e | 72% | 1m13s | 1m41s | 10m30s |
| docker | 68% | 1m12s | 2m05s | 2m46s |
| plan | 6% | 1m01s | 1m06s | 1m10s |
| infra | 48% | 41s | 45s | 47s |
| test | 90% | 39s | 47s | 1m05s |
| lint | 90% | 28s | 34s | 4m30s |
| typecheck | 90% | 22s | 29s | 5m34s |
| build | 76% | 19s | 23s | 42s |
| commits | 70% | 18s | 24s | 45s |
| scan-image, scan-config | 16–17% | 17s, 10s | | |
| workflows | 65% | 12s | 16s | 19s |
| changes, ci-ok | 100% | 5s, 3s | | |

## The steps that weigh the most

- **e2e:** installing Playwright's browsers takes 29s at the median, 40% of the job; the tests themselves 12s, `docker compose up` 14s.
  - The install is behind every extreme: 6 of 145 took over 2 minutes, from 3 to almost 10. Five of them fell on 2026-10-22.
  - A seventh came on 2026-10-26, after this data: the step hit the job's 15-minute timeout installing apt packages from a slow Ubuntu mirror (`azure.archive.ubuntu.com`, tens of kB/s), and the run was cancelled before any test ran.
- **docker:** building the image takes 31s at the median, 44% of the job, and 1m17s at the 90th percentile, depending on the cache. `check-image.sh` takes 12s, `check-scale.sh` 9s.
- **The setup action** (pnpm and Node) takes about 12s in every job that uses it, which is half of the short jobs (lint, typecheck, build). It ran 1,009 times, about 232 of CI's 938 job-minutes: a quarter of all runner time.
  - The 4- and 5-minute outliers of lint and typecheck come from this step: `pnpm install` on a slow runner.
- **infra:** `check-infra.sh`, 35s, 85% of the job.
- **plan:** planning the modules and validating their IAM policies, 49s.

## Conclusions

1. **CI's long tail has one source:** apt, while installing Playwright. Caching the browsers, or running the job in an image that already has their system packages (such as Playwright's container `mcr.microsoft.com/playwright`), would remove the spikes, one of which has already run out the timeout.
2. **The median is good:** about a minute and a half for code changes, about 20 seconds for docs only. Change detection works: 14% of the PRs are docs only, and they skip the heavy jobs.
3. **Repeated setup costs the most in total.** Every job sets up pnpm and Node again. It can be cut, for example by merging the short jobs (lint, typecheck, build) into one, at the price of a less readable `ci-ok` and less parallelism.
