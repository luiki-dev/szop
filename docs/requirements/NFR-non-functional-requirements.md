# Non-functional requirements (NFR)

The qualities every part of Szop must have. The reasoning and the alternatives are in [ADR 0013](../decisions/0013-visual-design.md); how they are met is described in the [visual design](../architecture/visual-design.md) and [architecture](../architecture/architecture.md) documents. Part of the [functional requirements](functional-requirements.md), which explain how requirements and their criteria are written and show the status of every requirement.

## NFR-1

🎯 [MVP] **Browsers:** Szop supports the current versions of Chrome, Edge and Firefox on the desktop, and Chrome on Android. Safari and iOS are not supported: Szop may work there, but it is not tested.

## NFR-2

🎯 [MVP] **Accessibility:** Szop meets the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA, in light and dark mode.

## NFR-3

🎯 [MVP] **Performance:** on a mid-range phone with a slow 4G connection, as Lighthouse's default mobile profile simulates it, Szop's Core Web Vitals are in the "good" range: the main content appears within 2.5 seconds (Largest Contentful Paint), taps get a visible response within 200 milliseconds (Interaction to Next Paint), and content does not jump around while loading (Cumulative Layout Shift at most 0.1). The JavaScript needed for the first screen is at most 200 KB compressed.
