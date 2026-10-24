# ADR 0046 — The health answer for the landing page

- **Status:** ✅ Accepted
- **Date:** 2026-10-24
- **Refines:** [ADR 0044](0044-landing-page-details.md), decision 5 (the status check: a `no-cors` request tells "an answer" from "none" only if the response's `Cross-Origin-Resource-Policy` lets the page receive it, so `/api/health` now sends `same-site`, see decision 1); [ADR 0012](0012-security-baseline.md), decision 8 (the security headers: one route differs from helmet's `same-origin`, see decision 1)

## Context

The landing page ([PH-34](../roadmap.md#ph-34-landing-page-and-demo-status), [ADR 0044](0044-landing-page-details.md)) shows a green dot when the demo is up. It asks `https://szop.dzwoniec.com/api/health` from `dzwoniec.com` with a `no-cors` request, and ADR 0044, decision 5, said that any answer resolves the request and so the application need not change.

That was wrong. The dot stayed grey with the demo up. `@fastify/helmet` keeps its default `Cross-Origin-Resource-Policy: same-origin` on every response ([ADR 0025](0025-web-security-baseline-details.md) turned off only helmet's CSP defaults), and a browser that receives such a response for a `no-cors` request from another origin **blocks it and fails the `fetch`** (`net::ERR_BLOCKED_BY_RESPONSE.NotSameOrigin`), as if nothing had answered. The unit tests of `checkDemo` use a fake `fetch`, which cannot show that, and the final review did not catch it.

## Decisions

| # | Topic | Options considered | Decision and reasoning |
|---|---|---|---|
| 1 | What the answer carries | `Cross-Origin-Resource-Policy: same-site` on `/api/health` only; `same-site` on every response (helmet's `crossOriginResourcePolicy`); `cross-origin` on `/api/health`; CORS headers on `/api/health` so the page reads the status; no change, with the page showing "unknown" | **`same-site` on `/api/health` only** _(the owner's choice)_. The page and the demo are sibling subdomains of `dzwoniec.com`, so they are the same site; `same-site` lets the page receive the answer and still refuses any other site. The answer stays opaque: the page reads neither the status nor the body. Every other response keeps `same-origin`, so the rest of the API is not opened to a future app on another subdomain. `cross-origin` would let any website receive it; a global `same-site` weakens every response for one route's sake; CORS would give the page more than it needs and would add a header set to maintain. The 503 the route sends while the database is down carries it too: it still counts as an answer ([ADR 0044](0044-landing-page-details.md), decision 5). |
| 2 | How the header is set | Helmet's per-route option; a header set in the route's handler | **`reply.header` at the top of the `/health` handler,** before either answer is built, next to a comment saying why. One line, in the route it concerns, and the tests of the header on both answers prove it; helmet's per-route option would be equivalent but hides the exception in route configuration. |
| 3 | Tests | The unit tests only; also a check in a real browser | **Route tests, and a browser check by hand.** The route tests prove the header on the 200 and on the 503, and that `/api/live` and an unknown path keep `same-origin`. The browser check ran Chromium against the real API and a page on a sibling subdomain: `/api/health` resolved (opaque) and `/api/live` was blocked. The owner's final check is the dot on `dzwoniec.com` with a running demo. |

## Consequences

- A page on any subdomain of `dzwoniec.com` can have its `no-cors` requests to `/api/health` answered, and learns from them only that the demo is up. The route's body (the commit, the instance, the database state) stays unreadable to it.
- The application changes by one header on one route, so the image changes, and the demo check applies.
- **Settled while building:** in Chromium a `no-cors` response is blocked for `same-origin`, and delivered (opaque) for `same-site`, `cross-origin` and no header; `same-site` works between sibling hostnames but did not between two ports of `127.0.0.1`, since an IP address has no registrable domain, so the browser check used host names.
