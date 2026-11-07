import { Drawer } from "@base-ui/react/drawer";
import { Undo2 } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  formatPrice,
  formatQuantity,
  haulItems,
  lineTotal,
  type CatalogUnit,
  type ListItem,
} from "@szop/shared";
import { useUpdateItem } from "../use-items.ts";
import { useCheckboxSide } from "../../shell/checkbox-side.ts";
import { fitChips } from "./fit-chips.ts";

const GAP = 8;
const chipClass =
  "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-haul-chip px-3 text-sm whitespace-nowrap";

// A chip or a ↶ button sends `checked: false`: the item returns to its card.
function usePutBack(listId: string, item: ListItem) {
  const update = useUpdateItem(listId, item.id);
  return () => {
    update.mutate({ checked: false });
  };
}

function ChipContent({ item }: { item: ListItem }) {
  const total = lineTotal(item);
  return (
    <>
      <span className="max-w-[12ch] truncate font-bold">{item.name}</span>
      {total !== null && (
        <span className="text-xs text-haul-muted">{formatPrice(total)}</span>
      )}
    </>
  );
}

// A chip enters with a short animation only when it is new: the ones already
// in the tray do not replay it when the tray unfolds.
function Chip({
  listId,
  item,
  seen,
}: {
  listId: string;
  item: ListItem;
  seen: ReadonlySet<string>;
}) {
  const putBack = usePutBack(listId, item);
  const [animate] = useState(() => !seen.has(item.id));
  return (
    <button
      type="button"
      aria-label={`Put ${item.name} back`}
      onClick={putBack}
      className={`${chipClass} outline-none focus-visible:ring-3 focus-visible:ring-haul-accent ${animate ? "motion-safe:animate-[chip-in_180ms_ease-out]" : ""}`}
    >
      <ChipContent item={item} />
    </button>
  );
}

function DrawerRow({
  listId,
  item,
  unitName,
}: {
  listId: string;
  item: ListItem;
  unitName: string | null;
}) {
  const putBack = usePutBack(listId, item);
  const left = useCheckboxSide() === "left";
  const total = lineTotal(item);
  const undo = (
    <button
      type="button"
      aria-label={`Put ${item.name} back`}
      onClick={putBack}
      className="flex size-12 shrink-0 items-center justify-center rounded-control border border-haul-muted outline-none focus-visible:ring-3 focus-visible:ring-haul-accent"
    >
      <Undo2 aria-hidden="true" />
    </button>
  );
  const quantity =
    item.quantity === null
      ? null
      : [formatQuantity(item.quantity), unitName].filter(Boolean).join(" ");
  return (
    <li className="flex min-h-14 items-center gap-3 border-t border-haul-chip">
      {left && undo}
      <span className="min-w-0 flex-1 font-semibold break-words">
        {item.name}
      </span>
      <span className="flex shrink-0 flex-col items-end text-sm">
        {quantity && <span className="text-haul-muted">{quantity}</span>}
        {total !== null && (
          <span className="font-bold">{formatPrice(total)}</span>
        )}
      </span>
      {!left && undo}
    </li>
  );
}

function Progress({ k, n }: { k: number; n: number }) {
  return (
    <div
      role="progressbar"
      aria-label="The haul"
      aria-valuemin={0}
      aria-valuenow={k}
      aria-valuemax={n}
      className="h-2 overflow-hidden rounded-full bg-haul-chip"
    >
      <div
        className="h-full bg-haul-accent"
        style={{ width: `${String(n ? (k / n) * 100 : 0)}%` }}
      />
    </div>
  );
}

// The haul (ORD-1): the checked items, newest first, as a tray under the add
// bar. Hidden while the list has no items. The drawer opens by a tap on the
// header or "+N more", or by dragging the handle up.
export function Haul({
  listId,
  items,
  units,
  folded,
}: {
  listId: string;
  items: ListItem[];
  units: readonly CatalogUnit[];
  folded: boolean;
}) {
  const [open, setOpen] = useState(false);
  const row = useRef<HTMLDivElement>(null);
  const measure = useRef<HTMLDivElement>(null);
  // How many chips fit; null until measured (then all are shown).
  const [fit, setFit] = useState<number | null>(null);
  const haul = haulItems(items);
  const [seen] = useState(() => new Set(haul.map((item) => item.id)));
  useEffect(() => {
    haul.forEach((item) => seen.add(item.id));
  });
  const n = items.length;
  const k = haul.length;
  const names = haul
    .map((item) => `${item.name}|${String(lineTotal(item))}`)
    .join();

  useLayoutEffect(() => {
    const rowEl = row.current;
    const measureEl = measure.current;
    if (!rowEl || !measureEl) return;
    const update = () => {
      const sizes = Array.from(measureEl.children, (c) =>
        c instanceof HTMLElement ? c.offsetWidth : 0,
      );
      const more = sizes.pop() ?? 0;
      // No layout (a hidden row, jsdom): show every chip.
      setFit(
        rowEl.clientWidth === 0
          ? null
          : fitChips(sizes, rowEl.clientWidth, more, GAP),
      );
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(rowEl);
    return () => {
      observer.disconnect();
    };
  }, [names, folded]);

  if (n === 0) return null;

  const unitNames = new Map(units.map((unit) => [unit.id, unit.name]));
  const shown = fit === null ? k : fit;
  const count = `${String(k)} of ${String(n)} items`;
  const tray = "rounded-t-surface bg-haul px-4 text-haul-foreground md:px-6";

  return (
    <Drawer.Root open={open} onOpenChange={setOpen} swipeDirection="down">
      {folded ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
          }}
          className={`${tray} flex min-h-11 w-full items-center text-left font-bold outline-none focus-visible:ring-3 focus-visible:ring-haul-accent`}
        >
          The haul · {count}
        </button>
      ) : (
        <section aria-label="The haul" className={`${tray} pb-3`}>
          <button
            type="button"
            onClick={() => {
              setOpen(true);
            }}
            onPointerDown={(event) => {
              // The release may land outside the handle: listen on the window.
              const from = event.clientY;
              const end = (up: PointerEvent) => {
                window.removeEventListener("pointerup", end);
                window.removeEventListener("pointercancel", end);
                if (up.type === "pointerup" && from - up.clientY > 24)
                  setOpen(true);
              };
              window.addEventListener("pointerup", end);
              window.addEventListener("pointercancel", end);
            }}
            className="block w-full touch-none py-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-haul-accent"
          >
            <span className="mx-auto mb-2 block h-1 w-10 rounded-full bg-haul-chip" />
            <span className="flex items-baseline justify-between gap-2">
              <span className="text-lg font-bold">The haul</span>
              <span className="font-bold">{count}</span>
            </span>
          </button>
          <Progress k={k} n={n} />
          {k === 0 ? (
            <p className="mt-2 flex min-h-11 items-center text-sm text-haul-muted">
              Check items off to drop them here
            </p>
          ) : (
            <div ref={row} className="relative mt-2 flex gap-2 overflow-hidden">
              {haul.slice(0, shown).map((item) => (
                <Chip key={item.id} listId={listId} item={item} seen={seen} />
              ))}
              {shown < k && (
                <button
                  type="button"
                  aria-label={`Show all ${String(k)} items in the haul`}
                  onClick={() => {
                    setOpen(true);
                  }}
                  className={`${chipClass} border border-haul-muted outline-none focus-visible:ring-3 focus-visible:ring-haul-accent`}
                >
                  +{k - shown} more
                </button>
              )}
              {/* Hidden copies, measured to see how many chips fit. */}
              <div
                ref={measure}
                aria-hidden="true"
                className="pointer-events-none invisible absolute flex gap-2"
              >
                {haul.map((item) => (
                  <span key={item.id} className={chipClass}>
                    <ChipContent item={item} />
                  </span>
                ))}
                <span className={chipClass}>+{k} more</span>
              </div>
            </div>
          )}
        </section>
      )}
      <Drawer.Portal>
        <Drawer.Backdrop className="fixed inset-0 z-50 bg-black/40 data-ending-style:opacity-0 data-starting-style:opacity-0 motion-safe:transition-opacity motion-safe:duration-200" />
        <Drawer.Popup className="fixed inset-x-0 bottom-0 z-50 mx-auto flex h-[75dvh] max-w-[720px] translate-y-(--drawer-swipe-movement-y) flex-col rounded-t-surface bg-haul px-4 pt-3 text-haul-foreground outline-none data-ending-style:translate-y-full data-starting-style:translate-y-full motion-safe:transition-[translate] motion-safe:duration-200 md:px-6 lg:left-64">
          <span className="mx-auto mb-2 block h-1 w-10 rounded-full bg-haul-chip" />
          <div className="flex items-baseline justify-between gap-2">
            <Drawer.Title className="text-lg font-bold">The haul</Drawer.Title>
            <span className="font-bold">{count}</span>
          </div>
          <div className="mt-2">
            <Progress k={k} n={n} />
          </div>
          <p className="mt-2 pb-2 text-xs text-haul-muted">
            Newest first · ↶ puts an item back
          </p>
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {haul.map((item) => (
              <DrawerRow
                key={item.id}
                listId={listId}
                item={item}
                unitName={
                  item.unitId === null
                    ? null
                    : (unitNames.get(item.unitId) ?? null)
                }
              />
            ))}
          </ul>
        </Drawer.Popup>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
