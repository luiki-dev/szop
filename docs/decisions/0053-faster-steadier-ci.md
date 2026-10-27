# ADR 0053 — Faster, steadier CI

- **Status:** ✅ Accepted
- **Date:** 2026-10-27
- **Refines:** [ADR 0026](0026-first-e2e-journey-details.md), decision 5 (the browsers are installed without `--with-deps`, see decision 1); [ADR 0010](0010-ci-cd.md), decision 9 (only pushes to `main` write the Docker layers to the cache, see decision 3)

## Context

[PH-41](../roadmap.md#ph-41-faster-steadier-ci) acts on the [CI run analysis of 2026-10-26](../audits/2026-10-26-ci-run-analysis.md), which measured 729 runs, and on [OP-108](https://github.com/luiki-dev/szop/issues/294), which listed what to look at. The median CI run was good, about a minute and a half for code changes, but the long tail had one source: installing Playwright's browsers took 29 seconds at the median and, on 7 runs, from 3 minutes to the `e2e` job's whole 15-minute timeout. apt was fetching the browsers' system libraries from a slow Ubuntu mirror.

The brainstorm was bounded: the owner skipped the questions and approved a proposed scope. Its main guess, that the runner image already has the system libraries, was checked on the phase's draft PR before this ADR was written. Without `--with-deps`, Chromium and Firefox started and every journey passed; the download alone took 11 seconds. A cache of the browsers, restored on two reruns, took the install to 1 second plus 5 seconds to restore it.

Looking at the repository's cache for that test showed something the analysis had not: of the 10 GB GitHub keeps per repository, 8.8 GB were in use, 7.7 GB of it Buildx layers written by the `docker` job with `mode=max`, most of them from pull requests. Past the limit GitHub evicts the least recently used entries, which is the likely reason the image build took 1m17s at the 90th percentile against 31 seconds at the median.

## Decisions

| # | Topic | Options considered | Decision and reasoning |
|---|---|---|---|
| 1 | Playwright's system libraries in CI | `--with-deps`, as before; cache the browsers and keep `--with-deps`; Playwright's container image; no `--with-deps` | **No `--with-deps`:** `playwright install chromium firefox`, so apt never runs. The `ubuntu-24.04` runner image ships Chrome and Firefox with their libraries, and the draft PR showed both of Playwright's builds start on it. A cache keeps apt in the path. The container image has the libraries too, but its tag must match `@playwright/test` exactly, which Dependabot does not bump together, and PostgreSQL would become a service container, a second place for its version against [ADR 0020](0020-database-details.md), decision 6. If a runner image ever drops a library, the browser fails to start with Playwright's message naming it, and `--with-deps` comes back. **Refines ADR 0026, decision 5.** |
| 2 | The browsers' cache | Cache `~/.cache/ms-playwright`, keyed by Playwright's version; no cache | **Still no cache,** as ADR 0026, decision 5 decided. Once apt is gone the download takes about 11 seconds and a restore about 5, and the cache would add 385 MB to a store that is already near its limit (decision 3). |
| 3 | The Docker layer cache | `cache-to` on every run, as before; `mode=min`; written by pushes to `main` only | **Written by pushes to `main` only:** a pull request reads `main`'s layers (`cache-from: type=gha`) and writes none, so pull requests no longer fill the cache and evict `main`'s layers. The price: a pull request that changes the dependencies rebuilds that layer on every push, since its own earlier build is not kept. `mode=min` keeps only the final stage's layers and would lose the cache of the build stage, which installs the dependencies. **Refines [ADR 0010](0010-ci-cd.md), decision 9.** |
| 4 | Stuck steps | The job's timeout only; a timeout per step | **A timeout per step:** the browser install times out after 5 minutes (`timeout-minutes` on the step), and the setup action's `pnpm install` after 3 (`timeout 3m`, since a composite action's steps take no `timeout-minutes`). A stuck download then fails in minutes and can be rerun, instead of holding a runner for the job's 10 or 15. The 4- and 5-minute outliers of `lint` and `typecheck` came from `pnpm install` on a slow runner. |
| 5 | The setup that every job repeats | Merge `lint`, `typecheck` and `build` into one job; keep them apart | **Kept apart.** The setup action costs about 12 seconds in each job and a quarter of CI's runner time, but the repository is public, so runner minutes cost nothing, and the run's wall time is set by `e2e` and `docker`, which take longer than the short jobs together. Merging them would save minutes no one pays for, at the price of a less readable `ci-ok` and of the jobs' parallelism. |
| 6 | The rest of OP-108 | Act on `docker compose up` (12 to 14 seconds in `test` and `e2e`); leave it | **Left as it is:** most of it is pulling the PostgreSQL image, and the gain is a few seconds. |
| 7 | Measuring the result | On the PR only; again after the merge | **Both.** The PR compares the `e2e` job's runs with the analysis's baseline. A full comparison needs about two weeks of runs on `main`: `collect.py` runs again then, as [OP-111](https://github.com/luiki-dev/szop/issues/304) records. |

## Consequences

- **CI's long tail no longer depends on Ubuntu's mirrors.** The browsers come from Playwright's own download servers; a slow download fails after 5 minutes.
- **The `e2e` job depends on what the runner image ships.** A new `ubuntu-24.04` image that drops a library the browsers need fails the job with Playwright's message; the fix is `--with-deps` again.
- **The Docker layer cache follows `main`.** The first push to `main` after the merge writes it; until then pull requests build from what is left in the cache. The caches pull requests wrote are evicted after 7 days without use.
- **Developers still install the browsers with `--with-deps`**, as the [setup guide](../development/setup.md) says: a developer's machine has no browser libraries installed in advance.
