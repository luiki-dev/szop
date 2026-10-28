import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { findMatch } from "./search.ts";
import { pluralize, type CatalogNode } from "./tree.ts";

// 20 px per level, as classes: the CSP blocks a style attribute, so a
// computed padding cannot be set inline. The spec allows five levels of
// categories, so products reach one more; a deeper one stays at the last.
const indent = ["pl-4", "pl-9", "pl-14", "pl-19", "pl-24", "pl-29"] as const;
const indentOf = (level: number) => indent[Math.min(level, indent.length - 1)];

interface TreeProps {
  nodes: readonly CatalogNode[];
  // IDs of the open categories, and the toggle of one.
  open: ReadonlySet<string>;
  onToggle: (id: string) => void;
  // Unit names by ID, for the unit shown at the right of a product.
  unitNames: ReadonlyMap<string, string>;
  // The search query, whose match in each name is highlighted.
  highlight?: string;
}

function Highlighted({ text, query }: { text: string; query?: string }) {
  const match = query === undefined ? null : findMatch(text, query);
  if (!match) return text;
  return (
    <>
      {text.slice(0, match[0])}
      <mark className="bg-accent text-accent-foreground">
        {text.slice(match[0], match[1])}
      </mark>
      {text.slice(match[1])}
    </>
  );
}

function CategoryItem({
  node,
  open,
  onToggle,
  unitNames,
  highlight,
}: Omit<TreeProps, "nodes"> & { node: CatalogNode }) {
  const { category, depth } = node;
  const isOpen = open.has(category.id);
  const hasRows = node.products.length > 0 || node.children.length > 0;
  const panelId = `category-${category.id}`;
  const count = pluralize(node.productCount, "product", "products");

  return (
    <li
      className={cn(depth === 0 && "overflow-hidden rounded-surface bg-card")}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={isOpen && hasRows ? panelId : undefined}
        aria-label={`${category.name}, ${count}`}
        onClick={() => {
          onToggle(category.id);
        }}
        className={cn(
          "flex w-full items-center gap-2 pr-4 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-inset",
          depth === 0 ? "min-h-14 rounded-surface" : "min-h-13 bg-muted",
          depth > 0 && "border-t border-border",
          indentOf(depth),
        )}
      >
        {isOpen ? (
          <ChevronDown
            aria-hidden="true"
            className="size-5 shrink-0 text-link"
          />
        ) : (
          <ChevronRight
            aria-hidden="true"
            className="size-5 shrink-0 text-link"
          />
        )}
        <span className="min-w-0 flex-1 py-2 font-semibold wrap-break-word">
          <Highlighted text={category.name} query={highlight} />
        </span>
        <span
          aria-hidden="true"
          className="shrink-0 rounded-full bg-accent px-2.5 py-0.5 text-sm font-semibold text-accent-foreground tabular-nums"
        >
          {node.productCount}
        </span>
      </button>
      {isOpen && hasRows && (
        <ul id={panelId}>
          {node.products.map((product) => {
            const unit =
              product.unitId === null
                ? undefined
                : unitNames.get(product.unitId);
            return (
              <li
                key={product.id}
                className={cn(
                  "flex min-h-12 items-center gap-3 border-t border-border py-2 pr-4",
                  indentOf(depth + 1),
                )}
              >
                <span
                  aria-hidden="true"
                  className="size-1.5 shrink-0 rounded-full bg-muted-foreground"
                />
                <span className="min-w-0 flex-1 wrap-break-word">
                  <Highlighted text={product.name} query={highlight} />
                </span>
                {unit !== undefined && (
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {unit}
                  </span>
                )}
              </li>
            );
          })}
          {node.children.map((child) => (
            <CategoryItem
              key={child.category.id}
              node={child}
              open={open}
              onToggle={onToggle}
              unitNames={unitNames}
              highlight={highlight}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// The categories as nested lists, each opened by a disclosure button (the
// pattern, not an ARIA tree: no arrow-key model to learn). Top-level
// categories are cards; below them a tinted band sets category rows apart
// from product rows.
export function CatalogTree({
  nodes,
  open,
  onToggle,
  unitNames,
  highlight,
}: TreeProps) {
  return (
    <ul className="flex flex-col gap-3">
      {nodes.map((node) => (
        <CategoryItem
          key={node.category.id}
          node={node}
          open={open}
          onToggle={onToggle}
          unitNames={unitNames}
          highlight={highlight}
        />
      ))}
    </ul>
  );
}
