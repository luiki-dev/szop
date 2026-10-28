import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { smallCatalog } from "../test/catalog.ts";
import { CatalogTree } from "./catalog-tree.tsx";
import { buildCatalogTree, type CatalogNode } from "./tree.ts";

const nodes = buildCatalogTree(smallCatalog);
const unitNames = new Map(smallCatalog.units.map((u) => [u.id, u.name]));
const all = new Set(smallCatalog.categories.map((c) => c.id));

function renderTree(
  open: ReadonlySet<string>,
  list: readonly CatalogNode[] = nodes,
) {
  render(
    <CatalogTree
      nodes={list}
      open={open}
      onToggle={() => {}}
      unitNames={unitNames}
    />,
  );
}

const category = (name: string) =>
  screen.getByRole("button", { name: new RegExp(`^${name}, \\d+ products?$`) });

describe("CatalogTree", () => {
  it("indents each level by 20 px and styles the top level as cards", () => {
    renderTree(all);

    const dairy = category("Dairy & eggs");
    expect(dairy).toHaveClass("pl-4", "min-h-14", "rounded-surface");
    expect(dairy).not.toHaveClass("border-t");
    expect(dairy.closest("li")).toHaveClass("overflow-hidden", "bg-card");
    const milk = category("Milk");
    expect(milk).toHaveClass("pl-9", "min-h-13", "bg-muted", "border-t");
    expect(milk).not.toHaveClass("min-h-14");
    expect(milk.closest("li")).not.toHaveClass("overflow-hidden");
    expect(screen.getByText("Eggs").closest("li")).toHaveClass("pl-9");
    expect(screen.getByText("Oat milk").closest("li")).toHaveClass("pl-19");
  });

  it("keeps a level deeper than the classes reach at the last one", () => {
    const deep = { ...nodes[2], depth: 6 } as CatalogNode;
    const bakery = { ...nodes[1], depth: 5 } as CatalogNode;
    renderTree(all, [deep, bakery]);

    expect(category("Empty shelf")).toHaveClass("pl-29");
    expect(screen.getByText("Bread").closest("li")).toHaveClass("pl-29");
  });

  it("links a button to its list only when it is open and has rows", () => {
    renderTree(new Set(["c1", "c6"]));

    expect(category("Dairy & eggs")).toHaveAttribute(
      "aria-controls",
      "category-c1",
    );
    expect(category("Bakery")).not.toHaveAttribute("aria-controls");
    expect(category("Empty shelf")).not.toHaveAttribute("aria-controls");
    expect(document.getElementById("category-c6")).toBeNull();
  });

  it("shows no unit element for a product without a unit", () => {
    renderTree(new Set(["c5"]));

    expect(screen.getByText("Bread").closest("li")?.children).toHaveLength(2);
    expect(screen.getByText("Croissant").closest("li")?.children).toHaveLength(
      3,
    );
  });
});
