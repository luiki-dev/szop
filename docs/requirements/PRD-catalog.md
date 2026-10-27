# Catalog (PRD)

The catalog of products: maintaining it, browsing it and searching it. Part of the [functional requirements](functional-requirements.md), which explain how requirements and their criteria are written and show the status of every requirement.

## PRD-1

🎯 [MVP] · ❔ Draft (0 of 4) · ❔ Criteria not finalized

Create, edit and delete catalog products (name, default category, default unit, default price).

| ID | Criterion | Status |
|---|---|---|
| PRD-1.1 | A user adds a product to the catalog, with a name and, if they want, a default category, unit and price. | ❔ Draft |
| PRD-1.2 | A user edits a product's name and defaults. | ❔ Draft |
| PRD-1.3 | A user deletes a product. | ❔ Draft |
| PRD-1.4 | A new product is suggested by the list's add bar from then on. | ❔ Draft |

## PRD-2

🎯 [MVP] · 🚧 In progress (0 of 12) · ✅ Criteria finalized ([PH-15a](../roadmap.md#ph-15a-seed-catalog-read-only))

Browse the catalog by category, and search it by product or category name.

| ID | Criterion | Status |
|---|---|---|
| PRD-2.1 | "Catalog" in the menu opens the catalog, for every visitor, with or without a workspace. | 🚧 [PH-15a](../roadmap.md#ph-15a-seed-catalog-read-only) |
| PRD-2.2 | The catalog shows the category tree in its order, each level indented; every category can be expanded and collapsed, and all start collapsed. | 🚧 [PH-15a](../roadmap.md#ph-15a-seed-catalog-read-only) |
| PRD-2.3 | A category's row stands apart from the products' rows and shows how many products it holds. | 🚧 [PH-15a](../roadmap.md#ph-15a-seed-catalog-read-only) |
| PRD-2.4 | "Expand all" and "Collapse all" open and close every category; they are icon buttons on a phone, with a label from 1024 px. | 🚧 [PH-15a](../roadmap.md#ph-15a-seed-catalog-read-only) |
| PRD-2.5 | Within a category, products are sorted alphabetically, and come before its subcategories. | 🚧 [PH-15a](../roadmap.md#ph-15a-seed-catalog-read-only) |
| PRD-2.6 | Search matches product names and category names: each match is shown with the path to it, opened, and the matched text highlighted. | 🚧 [PH-15a](../roadmap.md#ph-15a-seed-catalog-read-only) |
| PRD-2.7 | A category that matches the search is shown on its path, collapsed, unless something inside it matches too; then only those matches show. Opened by hand during a search, it shows its whole contents. | 🚧 [PH-15a](../roadmap.md#ph-15a-seed-catalog-read-only) |
| PRD-2.8 | While the catalog loads, cards shaped like its collapsed tree show; when it cannot be loaded, a card says so and offers "Try again". | 🚧 [PH-15a](../roadmap.md#ph-15a-seed-catalog-read-only) |
| PRD-2.9 | A long product name wraps. | 🚧 [PH-15a](../roadmap.md#ph-15a-seed-catalog-read-only) |
| PRD-2.10 | Search ignores case and accents, so "creme" finds "Crème fraîche". | 🚧 [PH-15a](../roadmap.md#ph-15a-seed-catalog-read-only) |
| PRD-2.11 | Clearing the search, with ✕ or Esc, restores what was expanded before it. | 🚧 [PH-15a](../roadmap.md#ph-15a-seed-catalog-read-only) |
| PRD-2.12 | When nothing matches, a card says "No products match" with the query. | 🚧 [PH-15a](../roadmap.md#ph-15a-seed-catalog-read-only) |

## PRD-3

🎯 [MVP] · ❔ Draft (0 of 1) · ❔ Criteria not finalized

Deleting a product does not affect list items created from it.

| ID | Criterion | Status |
|---|---|---|
| PRD-3.1 | Deleting a product leaves the list items created from it as they are. | ❔ Draft |
