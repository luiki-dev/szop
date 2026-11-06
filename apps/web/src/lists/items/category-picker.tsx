import { Drawer } from "@base-ui/react/drawer";
import { ArrowLeft, ChevronDown, ChevronRight, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { Catalog, CatalogCategory } from "@szop/shared";
import { Highlighted } from "../../catalog/catalog-tree.tsx";
import { searchTree, type SearchNode } from "../../catalog/search.ts";
import { buildCatalogTree, type CatalogNode } from "../../catalog/tree.ts";
import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";
import { desktopQuery, useMediaQuery } from "../../shell/use-media-query.ts";

// 20 px per level, as classes: the CSP blocks a style attribute.
const indent = ["pl-0", "pl-5", "pl-10", "pl-15", "pl-20", "pl-25"] as const;

interface Row {
  category: CatalogCategory;
  children: Row[];
}

const fromNode = (node: CatalogNode): Row => ({
  category: node.category,
  children: node.children.map(fromNode),
});
// A matching category with no match inside keeps its whole contents.
const fromSearch = (found: SearchNode): Row =>
  found.matched && found.children.length === 0
    ? fromNode(found.node)
    : {
        category: found.node.category,
        children: found.children.map(fromSearch),
      };

function Radio({
  checked,
  onPick,
  children,
}: {
  checked: boolean;
  onPick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onPick}
      className="flex min-h-13 min-w-0 flex-1 items-center gap-2 pr-4 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-inset"
    >
      <span
        className={cn(
          "min-w-0 flex-1 py-2 wrap-break-word",
          checked && "font-bold text-primary",
        )}
      >
        {children}
      </span>
      <span
        aria-hidden="true"
        className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground"
      >
        {checked && <span className="size-3 rounded-full bg-primary" />}
      </span>
    </button>
  );
}

function RowItem({
  row,
  depth,
  value,
  open,
  onToggle,
  onPick,
  query,
}: {
  row: Row;
  depth: number;
  value: string | null;
  open: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onPick: (id: string | null) => void;
  query: string;
}) {
  const { category } = row;
  const isOpen = open.has(category.id);
  const Chevron = isOpen ? ChevronDown : ChevronRight;
  return (
    <li>
      <div
        className={cn(
          "flex border-t border-border first:border-t-0",
          depth > 0 && "bg-muted",
          indent[Math.min(depth, indent.length - 1)],
        )}
      >
        {row.children.length > 0 ? (
          <button
            type="button"
            aria-expanded={isOpen}
            aria-label={`${category.name}, subcategories`}
            onClick={() => {
              onToggle(category.id);
            }}
            className="flex h-13 w-11 shrink-0 items-center justify-center outline-none focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-inset"
          >
            <Chevron aria-hidden="true" className="size-5 text-link" />
          </button>
        ) : (
          <span className="w-11 shrink-0" />
        )}
        <Radio
          checked={value === category.id}
          onPick={() => {
            onPick(category.id);
          }}
        >
          <Highlighted text={category.name} query={query} />
        </Radio>
      </div>
      {isOpen && row.children.length > 0 && (
        <ul>
          {row.children.map((child) => (
            <RowItem
              key={child.category.id}
              row={child}
              depth={depth + 1}
              value={value}
              open={open}
              onToggle={onToggle}
              onPick={onPick}
              query={query}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// The category tree as a radio group: the chevron opens a category's
// subcategories, the rest of the row picks it. A second Drawer over the edit
// sheet on a phone; on a desktop it takes the dialog's place, with ← back.
export function CategoryPicker({
  catalog,
  value,
  onPick,
  onBack,
}: {
  catalog: Catalog;
  value: string | null;
  onPick: (categoryId: string | null) => void;
  onBack: () => void;
}) {
  const desktop = useMediaQuery(desktopQuery);
  const tree = useMemo(
    () => buildCatalogTree({ ...catalog, products: [] }),
    [catalog],
  );
  const [text, setText] = useState("");
  const query = text.trim();
  const result = useMemo(() => searchTree(tree, query), [tree, query]);
  const rows = result ? result.nodes.map(fromSearch) : tree.map(fromNode);

  // Browsing opens the current category's ancestors; a search opens the paths
  // to its matches until the user toggles by hand.
  const [browseOpen, setBrowseOpen] = useState<ReadonlySet<string>>(() => {
    const ids = new Set<string>();
    let at = catalog.categories.find((c) => c.id === value);
    while (at?.parentId) {
      ids.add(at.parentId);
      const parentId = at.parentId;
      at = catalog.categories.find((c) => c.id === parentId);
    }
    return ids;
  });
  const [searchOpen, setSearchOpen] = useState<ReadonlySet<string> | null>(
    null,
  );
  const open = result ? (searchOpen ?? result.open) : browseOpen;
  function toggle(id: string) {
    const flip = (set: ReadonlySet<string>) => {
      const next = new Set(set);
      if (!next.delete(id)) next.add(id);
      return next;
    };
    if (result) setSearchOpen(flip(open));
    else setBrowseOpen(flip);
  }

  const title = desktop ? (
    <h2 className="flex-1 text-lg font-bold">Category</h2>
  ) : (
    <Drawer.Title className="flex-1 text-lg font-bold">Category</Drawer.Title>
  );
  const content = (
    <>
      <div className="flex items-center gap-2">
        {desktop && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back"
            onClick={onBack}
          >
            <ArrowLeft aria-hidden="true" />
          </Button>
        )}
        {title}
        {!desktop && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close"
            onClick={onBack}
          >
            <X aria-hidden="true" />
          </Button>
        )}
      </div>
      <input
        type="search"
        aria-label="Search categories"
        placeholder="Search categories"
        autoComplete="off"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setSearchOpen(null);
        }}
        className="mt-3 min-h-12 w-full rounded-control border-2 border-input bg-card px-3 outline-none focus:ring-3 focus:ring-ring"
      />
      <div role="radiogroup" aria-label="Category" className="mt-3">
        <ul className="overflow-hidden rounded-surface border border-border bg-card">
          <li className="flex border-b border-border">
            <span className="w-11 shrink-0" />
            <Radio
              checked={value === null}
              onPick={() => {
                onPick(null);
              }}
            >
              <em>No category</em>
            </Radio>
          </li>
          {rows.map((row) => (
            <RowItem
              key={row.category.id}
              row={row}
              depth={0}
              value={value}
              open={open}
              onToggle={toggle}
              onPick={onPick}
              query={query}
            />
          ))}
        </ul>
      </div>
    </>
  );

  if (desktop) return <div>{content}</div>;
  return (
    <Drawer.Root
      open
      onOpenChange={(next) => {
        if (!next) onBack();
      }}
      swipeDirection="down"
    >
      <Drawer.Portal>
        <Drawer.Backdrop className="fixed inset-0 z-60 bg-black/40" />
        <Drawer.Popup className="fixed inset-x-0 bottom-0 z-60 max-h-[90dvh] overflow-y-auto rounded-t-surface bg-card p-4 text-card-foreground shadow-lg outline-none">
          {content}
        </Drawer.Popup>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
