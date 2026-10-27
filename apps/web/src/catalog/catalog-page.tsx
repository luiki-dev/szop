import { ChevronsDownUp, ChevronsUpDown, Search, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import { CatalogTree } from "./catalog-tree.tsx";
import { searchTree, type SearchNode } from "./search.ts";
import {
  allCategoryIds,
  buildCatalogTree,
  pluralize,
  type CatalogNode,
} from "./tree.ts";
import { useCatalog } from "./use-catalog.ts";

// What the tree shows for a search node: only the matches inside it, with the
// count of what is shown. A matching category with no match inside shows its
// whole contents, which only matters once the user opens it.
function displayNode(found: SearchNode): CatalogNode {
  if (found.matched && found.products.length + found.children.length === 0) {
    return found.node;
  }
  return {
    ...found.node,
    products: found.products,
    children: found.children.map(displayNode),
    productCount: found.shownCount,
  };
}

function Skeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-3">
      {[0, 1, 2, 3, 4].map((card) => (
        <div
          key={card}
          data-testid="skeleton-card"
          className="h-14 rounded-surface bg-card motion-safe:animate-pulse"
        />
      ))}
    </div>
  );
}

// The Catalog page at /catalog: Szop's default catalog, read-only. The shell
// gives it its title. Which categories are open lives here and is not kept
// across visits.
export function CatalogPage() {
  const query = useCatalog();
  const catalog = query.data;
  const nodes = useMemo(
    () => (catalog ? buildCatalogTree(catalog) : []),
    [catalog],
  );
  const unitNames = useMemo(
    () => new Map(catalog?.units.map((unit) => [unit.id, unit.name])),
    [catalog],
  );
  // Closing a category leaves its children in the set, so opening it again
  // restores what was open inside.
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());

  const [text, setText] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const trimmed = text.trim();
  const result = useMemo(() => searchTree(nodes, trimmed), [nodes, trimmed]);
  // The search keeps its own open set, tied to the query it was made under: a
  // new query starts again from the paths to its matches, and the browsing
  // set is not touched while searching.
  const [searchToggled, setSearchToggled] = useState<{
    query: string;
    open: ReadonlySet<string>;
  } | null>(null);
  const searchOpen =
    searchToggled?.query === trimmed ? searchToggled.open : result?.open;
  const shown = useMemo(() => result?.nodes.map(displayNode), [result]);

  function toggle(id: string) {
    const flip = (previous: ReadonlySet<string>) => {
      const next = new Set(previous);
      if (!next.delete(id)) next.add(id);
      return next;
    };
    if (searchOpen) {
      setSearchToggled({ query: trimmed, open: flip(searchOpen) });
    } else {
      setOpen(flip);
    }
  }

  if (query.isError) {
    return (
      <section className="mt-4 rounded-surface bg-card p-4 text-card-foreground">
        <h2 className="text-lg font-bold">The catalog could not be loaded.</h2>
        <p className="mt-1 text-muted-foreground">{query.error.message}</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => {
            void query.refetch();
          }}
        >
          Try again
        </Button>
      </section>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      {catalog ? (
        <>
          <div role="search" className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
            />
            <input
              ref={input}
              type="search"
              aria-label="Search the catalog"
              placeholder="Search the catalog"
              value={text}
              onChange={(event) => {
                setText(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape" && text !== "") {
                  event.preventDefault();
                  setText("");
                }
              }}
              className="min-h-12 w-full rounded-surface border border-input bg-card py-2 pr-12 pl-11 text-card-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring [&::-webkit-search-cancel-button]:hidden"
            />
            {text !== "" && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setText("");
                  input.current?.focus();
                }}
                className="absolute top-1/2 right-0 flex size-12 -translate-y-1/2 items-center justify-center rounded-surface text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="tabular-nums">
              {result
                ? pluralize(result.productCount, "product", "products")
                : `${pluralize(nodes.length, "category", "categories")} · ${pluralize(catalog.products.length, "product", "products")}`}
            </p>
            {!result && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  aria-label="Expand all"
                  title="Expand all"
                  onClick={() => {
                    setOpen(allCategoryIds(nodes));
                  }}
                >
                  <ChevronsUpDown aria-hidden="true" />
                  <span className="hidden lg:inline">Expand all</span>
                </Button>
                <Button
                  variant="outline"
                  aria-label="Collapse all"
                  title="Collapse all"
                  onClick={() => {
                    setOpen(new Set());
                  }}
                >
                  <ChevronsDownUp aria-hidden="true" />
                  <span className="hidden lg:inline">Collapse all</span>
                </Button>
              </div>
            )}
          </div>
          {shown?.length === 0 ? (
            <section className="rounded-surface bg-card p-4 text-card-foreground">
              {`No products match "${trimmed}"`}
            </section>
          ) : (
            <CatalogTree
              nodes={shown ?? nodes}
              open={searchOpen ?? open}
              onToggle={toggle}
              unitNames={unitNames}
              highlight={result ? trimmed : undefined}
            />
          )}
        </>
      ) : (
        <Skeleton />
      )}
    </div>
  );
}
