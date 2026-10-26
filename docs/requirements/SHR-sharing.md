# Sharing (SHR)

Sharing a list with other people, by invitation or by link, with a role. Part of the [functional requirements](functional-requirements.md), which explain how requirements and their criteria are written and show the status of every requirement.

## SHR-1

🔜 [Later] · ❔ Draft (0 of 3) · ❔ Criteria not finalized

The owner can share a list with a registered user by email, as **shopper** or **editor**. The list appears in that user's "Shared with me" view.

| ID | Criterion | Status |
|---|---|---|
| SHR-1.1 | The owner shares a list with a registered user by their email address, as shopper or editor. | ❔ Draft |
| SHR-1.2 | A shared list appears in the invitee's "Shared with me" view. | ❔ Draft |
| SHR-1.3 | An invitation answers the same whether or not the address has an account. | ❔ Draft |

## SHR-2

🔜 [Later] · ❔ Draft (0 of 4) · ❔ Criteria not finalized

The owner can create a share link per role, and revoke or regenerate it. Anyone opening the link, including guests, gets that role. For a guest, access is tied to their anonymous session in that browser.

| ID | Criterion | Status |
|---|---|---|
| SHR-2.1 | The owner creates a share link for each role. | ❔ Draft |
| SHR-2.2 | Anyone who opens a share link, guests included, gets its role on the list. | ❔ Draft |
| SHR-2.3 | For a guest, opening a share link counts as their first change: it creates their guest workspace, and their access stays with that browser. | ❔ Draft · [OP-049](https://github.com/luiki-dev/szop/issues/113) |
| SHR-2.4 | The owner revokes a link or regenerates it; the old link stops working at once. | ❔ Draft |

## SHR-3

🔜 [Later] · ❔ Draft (0 of 3) · ❔ Criteria not finalized

The owner can change a collaborator's role or remove them. A collaborator can leave a shared list.

| ID | Criterion | Status |
|---|---|---|
| SHR-3.1 | The owner changes a collaborator's role. | ❔ Draft |
| SHR-3.2 | The owner removes a collaborator, and the list leaves their "Shared with me". | ❔ Draft |
| SHR-3.3 | A collaborator leaves a shared list. | ❔ Draft |

## SHR-4

🔜 [Later] · ❔ Draft (0 of 4) · ❔ Criteria not finalized

Only the owner can rename, archive, delete, duplicate or share the list.

| ID | Criterion | Status |
|---|---|---|
| SHR-4.1 | A shopper views the list and checks and unchecks its items, and can change nothing else. | ❔ Draft |
| SHR-4.2 | An editor also adds, edits and removes items, and changes the "sort by category" setting. | ❔ Draft |
| SHR-4.3 | Only the owner renames, archives, deletes, duplicates or shares the list. | ❔ Draft |
| SHR-4.4 | A collaborator who tries a change their role does not allow gets 403; a user who cannot see the list gets 404. | ❔ Draft · [OP-049](https://github.com/luiki-dev/szop/issues/113) |

## SHR-5

🔜 [Later] · ❔ Draft (0 of 4) · ❔ Criteria not finalized

A shared list uses the **owner's** category tree, category order and currency. An editor picks categories from the owner's tree. When an editor adds a product from their own catalog, its category is matched by name in the owner's tree, otherwise the item is uncategorized. "Save to catalog" saves to the editor's own catalog.

| ID | Criterion | Status |
|---|---|---|
| SHR-5.1 | A shared list shows the owner's category tree, category order and currency to every collaborator. | ❔ Draft |
| SHR-5.2 | An editor picks categories from the owner's tree. | ❔ Draft |
| SHR-5.3 | A product an editor adds from their own catalog keeps its category when the owner's tree has one with the same full path, or with the same name when only one category has it; otherwise it is uncategorized. | ❔ Draft · [OP-041](https://github.com/luiki-dev/szop/issues/100) |
| SHR-5.4 | An editor's "Save to catalog" saves to the editor's own catalog. | ❔ Draft |
