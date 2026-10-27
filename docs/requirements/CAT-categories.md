# Categories (CAT)

The category tree: creating, renaming, moving, reordering and deleting categories. Part of the [functional requirements](functional-requirements.md), which explain how requirements and their criteria are written and show the status of every requirement.

## CAT-1

🎯 [MVP] · ❔ Draft (0 of 6) · ❔ Criteria not finalized

Create, rename and delete categories at any level of the tree. Move a category under a different parent.

| ID | Criterion | Status |
|---|---|---|
| CAT-1.1 | A user creates a category at the top level or under any category. | ❔ Draft |
| CAT-1.2 | A user renames a category. | ❔ Draft |
| CAT-1.3 | A user moves a category, with its subcategories, under another category or to the top level. | ❔ Draft |
| CAT-1.4 | A move under the category itself or one of its subcategories is refused. | ❔ Draft · [OP-041](https://github.com/luiki-dev/szop/issues/100) |
| CAT-1.5 | Two moves made at the same moment never leave a loop in the tree. | ❔ Draft · [OP-041](https://github.com/luiki-dev/szop/issues/100) |
| CAT-1.6 | After any change to the tree, every list follows the new order. | ❔ Draft |

## CAT-2

🎯 [MVP] · ❔ Draft (0 of 1) · ❔ Criteria not finalized

Reorder sibling categories.

| ID | Criterion | Status |
|---|---|---|
| CAT-2.1 | A user reorders the categories that share a parent, and every list follows the new order. | ❔ Draft |

## CAT-3

🎯 [MVP] · ❔ Draft (0 of 3) · ❔ Criteria not finalized

Deleting a category also deletes its subcategories. The confirmation shows how many products and items are affected. Catalog products and list items labeled with a deleted category become uncategorized.

| ID | Criterion | Status |
|---|---|---|
| CAT-3.1 | Deleting a category also deletes its subcategories. | ❔ Draft |
| CAT-3.2 | Before deleting, the confirmation says how many catalog products and list items will lose their category. | ❔ Draft |
| CAT-3.3 | Catalog products, list items and template items labeled with a deleted category become uncategorized. | ❔ Draft · [OP-041](https://github.com/luiki-dev/szop/issues/100) |
