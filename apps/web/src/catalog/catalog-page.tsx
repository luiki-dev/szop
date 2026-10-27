import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import { CatalogTree } from "./catalog-tree.tsx";
import { allCategoryIds, buildCatalogTree, pluralize } from "./tree.ts";
import { useCatalog } from "./use-catalog.ts";

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

  function toggle(id: string) {
    setOpen((previous) => {
      const next = new Set(previous);
      if (!next.delete(id)) next.add(id);
      return next;
    });
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
          <div className="flex items-center justify-between gap-2">
            <p className="tabular-nums">
              {pluralize(nodes.length, "category", "categories")} ·{" "}
              {pluralize(catalog.products.length, "product", "products")}
            </p>
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
          </div>
          <CatalogTree
            nodes={nodes}
            open={open}
            onToggle={toggle}
            unitNames={unitNames}
          />
        </>
      ) : (
        <Skeleton />
      )}
    </div>
  );
}
