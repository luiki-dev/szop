# Appearance (APR)

How the app looks: the color scheme and the checkboxes' side. Part of the [functional requirements](functional-requirements.md), which explain how requirements and their criteria are written and show the status of every requirement.

## APR-1

🎯 [MVP] · ✅ Done (5 of 5) · ✅ Criteria finalized ([PH-40](../roadmap.md#ph-40-acceptance-criteria))

The user chooses the color scheme: system (the default), light or dark. The choice is kept on the device ([ADR 0048](../decisions/0048-design-system-phase-details.md), decision 5; [ADR 0049](../decisions/0049-app-shell-phase-details.md), decision 6).

| ID | Criterion | Status |
|---|---|---|
| APR-1.1 | The bottom of the menu offers System, Light and Dark, each with an icon and a label, always in view. | ✅ [PH-14b](../roadmap.md#ph-14b-app-shell) |
| APR-1.2 | System is the default, and while it is chosen the app follows the device's setting, also when that changes while the app is open. | ✅ [PH-14b](../roadmap.md#ph-14b-app-shell) |
| APR-1.3 | A chosen Light or Dark stays when the device's setting changes. | ✅ [PH-14b](../roadmap.md#ph-14b-app-shell) |
| APR-1.4 | The choice survives a reload and is applied before the page first paints, so the page never shows the other scheme first. | ✅ [PH-14b](../roadmap.md#ph-14b-app-shell) |
| APR-1.5 | When the browser cannot store the choice, the control still switches the page for as long as it stays open. | ✅ [PH-14b](../roadmap.md#ph-14b-app-shell) |

## APR-2

🎯 [MVP] · 🚧 In progress (0 of 3) · ✅ Criteria finalized ([PH-17](../roadmap.md#ph-17-list-items))

The user chooses on which side of an item's row its checkbox sits: left or right, right by default. The choice is kept on the device ([ADR 0071](../decisions/0071-list-items-phase-details.md), decisions 1 and 2).

| ID | Criterion | Status |
|---|---|---|
| APR-2.1 | The bottom of the menu, under the color scheme, and the ⋮ menu inside a list, after "Sort by category", offer "Checkboxes", Left or Right, each with a small picture of a row; Right is the default. | 🚧 [PH-17](../roadmap.md#ph-17-list-items) |
| APR-2.2 | With Right, the checkbox sits at the row's right edge, after the quantity and price; with Left, at its left edge; the haul drawer's ↶ buttons follow the same side. The choice applies to every list. | 🚧 [PH-17](../roadmap.md#ph-17-list-items) |
| APR-2.3 | The choice survives a reload; when the browser cannot store it, the control still switches the page for as long as it stays open. | 🚧 [PH-17](../roadmap.md#ph-17-list-items) |
