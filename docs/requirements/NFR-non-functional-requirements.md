# Non-functional requirements (NFR)

The qualities every part of Szop must have. The reasoning and the alternatives are in [ADR 0013](../decisions/0013-visual-design.md); how they are met is described in the [visual design](../architecture/visual-design.md) and [architecture](../architecture/architecture.md) documents. Part of the [functional requirements](functional-requirements.md), which explain how requirements and their criteria are written and show the status of every requirement.

## NFR-1

🎯 [MVP] · ✅ Done (1 of 1) · ✅ Criteria finalized ([PH-40](../roadmap.md#ph-40-acceptance-criteria))

**Browsers:** Szop supports the current versions of Chrome, Edge and Firefox on the desktop, and Chrome on Android. Safari and iOS are not supported: Szop may work there, but it is not tested.

| ID | Criterion | Status |
|---|---|---|
| NFR-1.1 | Every end-to-end journey passes in desktop Chromium, desktop Firefox and an emulated Android phone (Pixel 7). | ✅ [PH-07](../roadmap.md#ph-07-first-e2e-journey) |

## NFR-2

🎯 [MVP] · 🚧 In progress (8 of 8) · ❔ Criteria not finalized

**Accessibility:** Szop meets the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA, in light and dark mode.

| ID | Criterion | Status |
|---|---|---|
| NFR-2.1 | Every page an end-to-end journey visits passes axe's WCAG 2.2 A and AA rules (`wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa`), in light and in dark mode. | ✅ [PH-07](../roadmap.md#ph-07-first-e2e-journey) |
| NFR-2.2 | Every pair of color roles the pages render meets its contrast in light and in dark mode: 4.5:1 for text, 3:1 for the parts of controls. | ✅ [PH-14a](../roadmap.md#ph-14a-design-system) |
| NFR-2.3 | Every button, and every link in the menu, is at least 48 px high. | ✅ [PH-14a](../roadmap.md#ph-14a-design-system) |
| NFR-2.4 | Everything focused with the keyboard shows a visible focus ring. | ✅ [PH-14a](../roadmap.md#ph-14a-design-system) |
| NFR-2.5 | When a dialog or drawer closes, focus returns to the control that opened it. | ✅ [PH-14b](../roadmap.md#ph-14b-app-shell) |
| NFR-2.6 | While a dialog or drawer is open, focus stays inside it. | ✅ [PH-14b](../roadmap.md#ph-14b-app-shell) |
| NFR-2.7 | Motion lasts 150 to 200 ms and is off when the system asks for reduced motion. | ✅ [PH-14b](../roadmap.md#ph-14b-app-shell) |
| NFR-2.8 | The focus ring is drawn in the `ring` color, on links as on buttons. | ✅ [PH-15a](../roadmap.md#ph-15a-seed-catalog-read-only) · wording confirmed by the owner ([OP-107](https://github.com/luiki-dev/szop/issues/292)) |

## NFR-3

🎯 [MVP] · 🚧 In progress (3 of 3) · ❔ Criteria not finalized

**Performance:** on a mid-range phone with a slow 4G connection, as Lighthouse's default mobile profile simulates it, Szop's Core Web Vitals are in the "good" range: the main content appears within 2.5 seconds (Largest Contentful Paint), taps get a visible response within 200 milliseconds (Interaction to Next Paint), and content does not jump around while loading (Cumulative Layout Shift at most 0.1). The JavaScript needed for the first screen is at most 200 KB compressed.

| ID | Criterion | Status |
|---|---|---|
| NFR-3.1 | The JavaScript the first screen needs is at most 200 KB compressed with Brotli; a build over it fails. | ✅ [PH-06a](../roadmap.md#ph-06a-production-build-and-serving) |
| NFR-3.2 | The app's files are sent compressed with Brotli or gzip; files with a content hash in their name are cached for a year, and `index.html` is never cached. | ✅ [PH-06a](../roadmap.md#ph-06a-production-build-and-serving) |
| NFR-3.3 | On Lighthouse's mobile profile, on the demo, Largest Contentful Paint is at most 2.5 s and Cumulative Layout Shift at most 0.1, with Total Blocking Time standing in for Interaction to Next Paint. | ✅ [PH-12c](../roadmap.md#ph-12c-app-on-ecs-and-rds) · checked at the demo |

## NFR-4

🎯 [MVP] · 🚧 In progress (7 of 11) · ❔ Criteria not finalized

**Security:** other sites cannot act in a user's name or frame the app, nothing travels over plain HTTP, tokens do not leak through addresses or logs, users reach only their own data, and errors reveal nothing about the server ([ADR 0012](../decisions/0012-security-baseline.md), [ADR 0025](../decisions/0025-web-security-baseline-details.md), the [threat model](../architecture/threat-model.md)). The account rules (passwords, sessions, never revealing whether an account exists) are in [ACC](ACC-accounts-and-guest-mode.md).

| ID | Criterion | Status |
|---|---|---|
| NFR-4.1 | A POST, PUT, PATCH or DELETE request not sent by the app itself (`Sec-Fetch-Site: same-origin`, or, without that header, an `Origin` matching the app) gets 403, on every route. | ✅ [PH-06b](../roadmap.md#ph-06b-web-security-baseline) |
| NFR-4.2 | A request body that is not JSON gets 415. | ✅ [PH-06b](../roadmap.md#ph-06b-web-security-baseline) |
| NFR-4.3 | Every response carries a Content Security Policy that allows only the app's own files and no framing (`frame-ancestors 'none'`), HTTP Strict Transport Security for one year with subdomains, and `Referrer-Policy: no-referrer`. | ✅ [PH-06b](../roadmap.md#ph-06b-web-security-baseline) |
| NFR-4.4 | No page breaks the Content Security Policy: no injected `<style>` element and no inline script. | ✅ [PH-07](../roadmap.md#ph-07-first-e2e-journey) |
| NFR-4.5 | Tokens in addresses travel in the query string, and the request log shows every query value as `[redacted]`. | ✅ [PH-06b](../roadmap.md#ph-06b-web-security-baseline) |
| NFR-4.6 | A request over plain HTTP is redirected to HTTPS. | 🚧 [PH-12b](../roadmap.md#ph-12b-network-and-the-demo-up-button) · to check at the next demo |
| NFR-4.7 | A forged `X-Forwarded-For` header does not change the client address that per-address limits and the log use. | ✅ [PH-06b](../roadmap.md#ph-06b-web-security-baseline) |
| NFR-4.8 | Once the app has used a token from the address (verification, password reset, a share link), it removes the token from the address bar. | ❔ Draft · [OP-055](https://github.com/luiki-dev/szop/issues/109) |
| NFR-4.9 | The session cookie is `HttpOnly`, `Secure` and `SameSite=Lax`, has no `Domain` attribute and carries the `__Host-` prefix (or `__Secure-` if the auth library does not allow it); a revoked session stops working at once. | 🚧 [PH-16a](../roadmap.md#ph-16a-guests-first-list) |
| NFR-4.10 | A request that names a record of another workspace, anywhere in its path, query or body, gets the same 404 as a request for a record that does not exist. | 🚧 [PH-16a](../roadmap.md#ph-16a-guests-first-list) (lists; references between records in [PH-16b](../roadmap.md#ph-16b-workspace-from-the-default-data)) |
| NFR-4.11 | An unexpected error answers 500 with a generic message; the details go to the log, never to the browser. | ✅ [PH-15a](../roadmap.md#ph-15a-seed-catalog-read-only) |
