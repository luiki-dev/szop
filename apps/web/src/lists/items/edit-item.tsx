import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog } from "@base-ui/react/dialog";
import { Drawer } from "@base-ui/react/drawer";
import { ChevronRight, Minus, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import {
  formatAmountInput,
  formatPrice,
  formatQuantity,
  itemLimits,
  lineTotal,
  parseAmount,
  type Catalog,
  type CatalogUnit,
  type ListItem,
  type UpdateItem,
} from "@szop/shared";
import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";
import { desktopQuery, useMediaQuery } from "../../shell/use-media-query.ts";
import { useRemoveItem, useUpdateItem } from "../use-items.ts";
import { CategoryPicker } from "./category-picker.tsx";
import {
  itemFormSchema,
  toFormValues,
  type ItemFormValues,
} from "./item-form.ts";

const control =
  "min-h-12 w-full rounded-control border-2 border-input bg-card px-3 outline-none focus:ring-3 focus:ring-ring aria-invalid:border-destructive";
const stepper =
  "size-12 shrink-0 outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring disabled:opacity-40 inline-flex items-center justify-center";
const handle = "mx-auto mb-3 block h-1 w-10 rounded-full bg-border";

// "Edit item" (ITM-6): a bottom sheet on a phone, a centered dialog from `lg`.
// No field takes the focus on opening, so the phone's keyboard stays down.
export function EditItem({
  listId,
  item,
  open,
  onOpenChange,
  onRemoved,
  units,
  catalog,
}: {
  listId: string;
  item: ListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRemoved: (item: ListItem) => void;
  units: CatalogUnit[];
  catalog: Catalog;
}) {
  const desktop = useMediaQuery(desktopQuery);
  // The picker replaces the dialog's content on a desktop, so the heading
  // and ✕ of the edit form give way to its own.
  const [picking, setPicking] = useState(false);
  const form = (
    <EditForm
      listId={listId}
      item={item}
      onOpenChange={onOpenChange}
      onRemoved={onRemoved}
      units={units}
      catalog={catalog}
      desktop={desktop}
      picking={picking}
      setPicking={setPicking}
    />
  );
  const hideEdit = desktop && picking;
  const popup = useRef<HTMLDivElement>(null);
  const close = <X aria-hidden="true" />;
  const closeButton = (
    <Button
      variant="ghost"
      size="icon"
      className="absolute top-2 right-2"
      aria-label="Close"
    />
  );
  const heading = "pr-12 text-lg font-bold";
  const backdrop =
    "fixed inset-0 z-50 bg-black/40 data-ending-style:opacity-0 data-starting-style:opacity-0 motion-safe:transition-opacity motion-safe:duration-200";
  if (desktop) {
    return (
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Backdrop className={backdrop} />
          <Dialog.Popup
            // The dialog itself, not a field: the focus must leave the list
            // behind, or Tab walks through it first (#405).
            initialFocus={popup}
            ref={popup}
            className={cn(
              // Centered on the column beside the 16rem sidebar (#406).
              "fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-full max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-surface bg-card p-4 text-card-foreground shadow-lg outline-none lg:left-[calc(50%+8rem)]",
              // The picker keeps one height while its results change (#406).
              hideEdit && "h-[90dvh]",
            )}
          >
            <Dialog.Title className={hideEdit ? "sr-only" : heading}>
              Edit item
            </Dialog.Title>
            {!hideEdit && (
              <Dialog.Close render={closeButton}>{close}</Dialog.Close>
            )}
            {form}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} swipeDirection="down">
      <Drawer.Portal>
        <Drawer.Backdrop className={backdrop} />
        <Drawer.Popup
          initialFocus={false}
          className="fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] translate-y-(--drawer-swipe-movement-y) overflow-y-auto rounded-t-surface bg-card p-4 text-card-foreground shadow-lg outline-none data-ending-style:translate-y-full data-starting-style:translate-y-full motion-safe:transition-[translate] motion-safe:duration-200"
        >
          <span aria-hidden="true" className={handle} />
          <Drawer.Title className={heading}>Edit item</Drawer.Title>
          <Drawer.Close render={closeButton}>{close}</Drawer.Close>
          {form}
        </Drawer.Popup>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 flex-1">
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-semibold">
        {label}
      </label>
      {children}
      {error && (
        <p
          id={`${htmlFor}-error`}
          role="alert"
          className="mt-1 text-sm text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}

function EditForm({
  listId,
  item,
  onOpenChange,
  onRemoved,
  units,
  catalog,
  desktop,
  picking,
  setPicking,
}: {
  listId: string;
  item: ListItem;
  onOpenChange: (open: boolean) => void;
  onRemoved: (item: ListItem) => void;
  units: CatalogUnit[];
  catalog: Catalog;
  desktop: boolean;
  picking: boolean;
  setPicking: (picking: boolean) => void;
}) {
  const update = useUpdateItem(listId, item.id);
  const remove = useRemoveItem(listId, item.id);
  const {
    register,
    handleSubmit,
    control: formControl,
    setValue,
    formState,
  } = useForm<ItemFormValues, unknown, UpdateItem>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: toFormValues(item),
    mode: "onBlur",
  });
  const { errors } = formState;
  const [quantityText, priceText, categoryId] = useWatch({
    control: formControl,
    name: ["quantity", "price", "categoryId"],
  });
  const category = catalog.categories.find((c) => c.id === categoryId);
  const categoryField = useRef<HTMLButtonElement>(null);
  // Back from the picker: the focus returns to the Category field.
  const wasPicking = useRef(false);
  useEffect(() => {
    if (wasPicking.current && !picking) categoryField.current?.focus();
    wasPicking.current = picking;
  }, [picking]);

  const quantity = parseAmount(quantityText, 3);
  const price = parseAmount(priceText, 2);
  const current = quantity.ok ? quantity.value : undefined;
  const canIncrease =
    current !== undefined && (current ?? 0) + 1000 <= itemLimits.quantity.max;
  const canDecrease =
    current !== undefined && current !== null && current > 1000;
  const step = (by: number) => {
    setValue("quantity", formatAmountInput((current ?? 0) + by, 3), {
      shouldDirty: true,
    });
  };
  const total =
    quantity.ok && price.ok && price.value !== null
      ? lineTotal({ price: price.value, quantity: quantity.value })
      : null;

  return (
    <>
      <form
        noValidate
        className={cn(
          "mt-3 flex flex-col gap-4",
          desktop && picking && "hidden",
        )}
        onSubmit={(event) => {
          void handleSubmit((values) => {
            update.mutate(values);
            onOpenChange(false);
          })(event);
        }}
      >
        <Field label="Name" htmlFor="edit-name" error={errors.name?.message}>
          <input
            id="edit-name"
            {...register("name")}
            maxLength={itemLimits.name}
            autoComplete="off"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "edit-name-error" : undefined}
            className={control}
          />
        </Field>
        <div className="flex gap-3">
          <Field
            label="Quantity"
            htmlFor="edit-quantity"
            error={errors.quantity?.message}
          >
            <div className="flex rounded-control border-2 border-input bg-card focus-within:ring-3 focus-within:ring-ring">
              <button
                type="button"
                aria-label="Decrease quantity"
                className={stepper}
                disabled={!canDecrease}
                onClick={() => {
                  step(-1000);
                }}
              >
                <Minus aria-hidden="true" />
              </button>
              <input
                id="edit-quantity"
                {...register("quantity")}
                inputMode="decimal"
                autoComplete="off"
                aria-invalid={!!errors.quantity}
                aria-describedby={
                  errors.quantity ? "edit-quantity-error" : undefined
                }
                onKeyDown={(event) => {
                  const by = { ArrowUp: 1000, ArrowDown: -1000 }[event.key];
                  if (by === undefined) return;
                  event.preventDefault();
                  if (by > 0 ? canIncrease : canDecrease) step(by);
                }}
                className="min-h-12 min-w-0 flex-1 border-x-2 border-input bg-transparent px-1 text-center outline-none aria-invalid:border-destructive"
              />
              <button
                type="button"
                aria-label="Increase quantity"
                className={stepper}
                disabled={!canIncrease}
                onClick={() => {
                  step(1000);
                }}
              >
                <Plus aria-hidden="true" />
              </button>
            </div>
          </Field>
          <Field label="Unit" htmlFor="edit-unit">
            <select id="edit-unit" {...register("unitId")} className={control}>
              <option value="">No unit</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field
          label="Price per unit"
          htmlFor="edit-price"
          error={errors.price?.message}
        >
          <div className="relative">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground"
            >
              €
            </span>
            <input
              id="edit-price"
              {...register("price")}
              inputMode="decimal"
              autoComplete="off"
              aria-invalid={!!errors.price}
              aria-describedby={errors.price ? "edit-price-error" : undefined}
              className={cn(control, "pl-8")}
            />
          </div>
          {total !== null &&
            quantity.ok &&
            price.ok &&
            price.value !== null && (
              <p className="mt-1 text-sm text-muted-foreground">
                {quantity.value === null
                  ? ""
                  : `${formatQuantity(quantity.value)} × `}
                {formatPrice(price.value)} = {formatPrice(total)}
              </p>
            )}
        </Field>
        <div>
          <span
            id="edit-category-label"
            className="mb-1 block text-sm font-semibold"
          >
            Category
          </span>
          <button
            ref={categoryField}
            type="button"
            aria-labelledby="edit-category-label edit-category-value"
            onClick={() => {
              setPicking(true);
            }}
            className={cn(
              control,
              "flex items-center justify-between text-left",
            )}
          >
            <span
              id="edit-category-value"
              className={cn(!category && "italic")}
            >
              {category?.name ?? "No category"}
            </span>
            <ChevronRight aria-hidden="true" className="size-5" />
          </button>
        </div>
        <Field label="Note" htmlFor="edit-note">
          <textarea
            id="edit-note"
            {...register("note")}
            maxLength={itemLimits.note}
            rows={2}
            className={cn(control, "field-sizing-content py-2")}
          />
        </Field>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            className="mr-auto min-h-12 text-destructive"
            onClick={() => {
              remove.mutate();
              onRemoved(item);
              onOpenChange(false);
            }}
          >
            Remove
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-12"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button type="submit" className="min-h-12">
            Save
          </Button>
        </div>
      </form>
      {picking && (
        <CategoryPicker
          catalog={catalog}
          value={categoryId}
          onPick={(id) => {
            setValue("categoryId", id, { shouldDirty: true });
            setPicking(false);
          }}
          onBack={() => {
            setPicking(false);
          }}
        />
      )}
    </>
  );
}
