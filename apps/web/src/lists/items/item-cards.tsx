import type { CatalogUnit, ItemCard, ListItem } from "@szop/shared";
import { ItemCheckbox } from "./item-checkbox.tsx";
import { ItemRow } from "./item-row.tsx";

export function ItemCardsSkeleton() {
  return (
    <div aria-busy="true" className="mt-4 flex flex-col gap-3">
      {[0, 1, 2].map((card) => (
        <div
          key={card}
          data-testid="skeleton-card"
          className="h-28 rounded-surface bg-card motion-safe:animate-pulse"
        />
      ))}
    </div>
  );
}

// One card per category with unchecked items (ORD-2), or the one card of a
// list that is not sorted (ORD-5.5). The card's header names the category and
// counts what is left.
export function ItemCards({
  listId,
  cards,
  units,
  onEdit,
}: {
  listId: string;
  cards: ItemCard[];
  units: readonly CatalogUnit[];
  onEdit: (item: ListItem) => void;
}) {
  const unitNames = new Map(units.map((unit) => [unit.id, unit.name]));
  return (
    <div className="mt-4 flex flex-col gap-3">
      {cards.map((card) => (
        <section
          key={card.kind === "category" ? card.category.id : card.kind}
          className="rounded-surface bg-card px-1 text-card-foreground"
        >
          <header className="flex items-baseline justify-between gap-2 px-3 pt-3 pb-1 text-sm">
            {card.kind === "category" && (
              <h2 className="font-bold">{card.category.name}</h2>
            )}
            {card.kind === "uncategorized" && (
              <h2 className="font-bold italic">No category</h2>
            )}
            {card.kind === "all" && <span />}
            <span className="text-muted-foreground">
              {card.items.length} left
            </span>
          </header>
          <ul>
            {card.items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                unitName={
                  item.unitId === null
                    ? null
                    : (unitNames.get(item.unitId) ?? null)
                }
                onEdit={() => {
                  onEdit(item);
                }}
                checkbox={<ItemCheckbox listId={listId} item={item} />}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
