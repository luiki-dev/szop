import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ListItem } from "@szop/shared";
import { useQueryClient } from "@tanstack/react-query";
import { itemCards, listSchema, orderCategories } from "@szop/shared";
import { useNavigate, useParams } from "react-router";
import { Button } from "@/components/ui/button.tsx";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { storeCheckboxSide, useCheckboxSide } from "../shell/checkbox-side.ts";
import { RowPicture } from "../shell/checkbox-side-control.tsx";
import { useCatalog } from "../catalog/use-catalog.ts";
import { ApiRequestError, notSaved } from "../api/client.ts";
import { NotFound } from "../not-found/not-found.tsx";
import { DeleteListsDialog } from "./delete-lists-dialog.tsx";
import { AddBar } from "./items/add-bar.tsx";
import { Haul } from "./items/haul.tsx";
import { EditItem } from "./items/edit-item.tsx";
import { ItemCards, ItemCardsSkeleton } from "./items/item-cards.tsx";
import { UndoRemove } from "./items/undo-remove.tsx";
import { EmptyList, ListHeader, TitleField } from "./list-screen.tsx";
import { useKeyboardOpen } from "./items/use-keyboard-open.ts";
import { useSortByCategory } from "./use-items.ts";
import { useList, useRenameList } from "./use-lists.ts";

// /lists/:id: the list's screen. The shell leaves its header and the tab's
// title to this page.
// The height of the bottom block (add bar and haul) goes to the toast region
// as --toast-offset, so toasts sit just above it whatever the haul shows.
function useToastOffset() {
  return useCallback((block: HTMLElement | null) => {
    if (!block || typeof ResizeObserver === "undefined") return;
    const root = document.documentElement.style;
    const observer = new ResizeObserver(() => {
      root.setProperty("--toast-offset", `${String(block.offsetHeight)}px`);
    });
    observer.observe(block);
    return () => {
      observer.disconnect();
      root.removeProperty("--toast-offset");
    };
  }, []);
}

export function ListPage() {
  // Stryker disable next-line StringLiteral: the route always supplies :id; the default only satisfies the type
  const { id = "" } = useParams();
  // An address that is not a list ID never reaches the API.
  const valid = listSchema.shape.id.safeParse(id).success;
  const query = useList(id, valid);
  const catalog = useCatalog();
  const rename = useRenameList(id);
  const sort = useSortByCategory(id);
  const checkboxSide = useCheckboxSide();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const queryClient = useQueryClient();
  const deleted = useRef(false);
  const askDelete = useRef(false);
  const bottomBlock = useToastOffset();
  const [barFocused, setBarFocused] = useState(false);
  const keyboardOpen = useKeyboardOpen();
  const [editing, setEditing] = useState<ListItem | null>(null);
  // The latest removed item holds the Undo toast; the count renews it when the same item goes twice.
  const [removed, setRemoved] = useState<{ item: ListItem; n: number } | null>(
    null,
  );

  // A deleted list leaves the cache once this screen no longer observes it:
  // removed earlier, it would be refetched (a 404) before the navigation lands.
  useEffect(
    () => () => {
      if (deleted.current) {
        // Stryker disable next-line BooleanLiteral: no query key extends ["lists", id], so exact and prefix match the same entry
        queryClient.removeQueries({ queryKey: ["lists", id], exact: true });
      }
    },
    // Stryker disable next-line ArrayDeclaration: both dependencies are stable for the life of the screen
    [queryClient, id],
  );
  const input = useRef<HTMLInputElement>(null);
  const renaming = useRef(false);
  const name = query.data?.name;

  useEffect(() => {
    document.title = name ? `${name} · Szop` : "Szop";
  }, [name]);

  const missing =
    !valid ||
    (query.error instanceof ApiRequestError && query.error.status === 404);
  if (missing) {
    return (
      <>
        <h1 className="sr-only">List</h1>
        <ListHeader field={null} />
        <NotFound message="This list doesn't exist or was deleted." />
      </>
    );
  }
  // A failed refetch keeps the screen: the card is for a list never loaded.
  if (query.isLoadingError || (catalog.isError && !catalog.data)) {
    return (
      <>
        <ListHeader field={null} />
        <section className="mt-4 rounded-surface bg-card p-4 text-card-foreground">
          <h1 className="text-lg font-bold">The list could not be loaded.</h1>
          <p className="mt-1 text-muted-foreground">
            {(query.error ?? catalog.error)?.message}
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => {
              void query.refetch();
              void catalog.refetch();
            }}
          >
            Try again
          </Button>
        </section>
      </>
    );
  }
  if (name === undefined) {
    return (
      <>
        <h1 className="sr-only">List</h1>
        <ListHeader field={null} />
      </>
    );
  }

  const cards =
    query.data && catalog.data
      ? itemCards(
          query.data.items,
          orderCategories(catalog.data.categories),
          query.data.sortByCategory,
        )
      : [];

  return (
    <>
      <h1 className="sr-only">{name}</h1>
      <ListHeader
        field={
          <TitleField
            initial={name}
            saveOnBlur
            inputRef={input}
            pending={rename.isPending}
            failed={
              rename.isError &&
              notSaved(rename.error) &&
              rename.variables !== name
            }
            {...(rename.isError && !notSaved(rename.error)
              ? { error: rename.error.message }
              : {})}
            onSave={(next) => {
              rename.mutate(next);
            }}
            onCancel={() => {
              rename.reset();
              // Stryker disable next-line OptionalChaining: the ref is set while the field is mounted
              input.current?.blur();
            }}
          />
        }
        menu={
          // The dialog opens once the menu has closed and given the focus back
          // to ⋮; opened sooner, that return takes the focus from Cancel.
          <DropdownMenu
            onOpenChangeComplete={(open) => {
              if (open || !askDelete.current) return;
              setDeleting(true);
            }}
          >
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="List actions"
                  className="shrink-0"
                />
              }
            >
              <MoreVertical aria-hidden="true" />
            </DropdownMenuTrigger>
            {/* After Rename, focus goes to the title; otherwise back to ⋮. */}
            <DropdownMenuContent
              finalFocus={() => {
                if (!renaming.current) return true;
                renaming.current = false;
                // Stryker disable next-line OptionalChaining: the ref is set while the field is mounted
                input.current?.select();
                return input.current;
              }}
            >
              <DropdownMenuCheckboxItem
                checked={query.data?.sortByCategory ?? true}
                onCheckedChange={(checked) => {
                  sort.mutate(checked);
                }}
              >
                Sort by category
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>Checkboxes</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={checkboxSide}
                  onValueChange={(side: unknown) => {
                    if (side === "left" || side === "right")
                      storeCheckboxSide(side);
                  }}
                >
                  {(["left", "right"] as const).map((side) => (
                    <DropdownMenuRadioItem key={side} value={side}>
                      {side === "left" ? "Left" : "Right"}
                      <span className="ml-auto">
                        <RowPicture side={side} />
                      </span>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  renaming.current = true;
                }}
              >
                <Pencil aria-hidden="true" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  askDelete.current = true;
                }}
              >
                <Trash2 aria-hidden="true" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
      {!query.data || !catalog.data ? (
        <ItemCardsSkeleton />
      ) : query.data.items.length === 0 ? (
        <EmptyList />
      ) : (
        <>
          {cards.length === 0 && (
            <p className="mt-16 text-center text-xl font-semibold text-muted-foreground">
              Everything&apos;s in the haul
            </p>
          )}
          <ItemCards
            listId={id}
            cards={cards}
            units={catalog.data.units}
            onEdit={setEditing}
          />
        </>
      )}
      {/* The add bar and the haul under it stay at the bottom of the column. */}
      <div
        ref={bottomBlock}
        data-bottom-block
        className="sticky bottom-0 z-10 -mx-4 mt-auto -mb-6 md:-mx-6"
      >
        <AddBar listId={id} listName={name} onFocusChange={setBarFocused} />
        {query.data && catalog.data && (
          <Haul
            listId={id}
            items={query.data.items}
            units={catalog.data.units}
            folded={barFocused && keyboardOpen}
          />
        )}
      </div>
      {editing && catalog.data && (
        <EditItem
          key={editing.id}
          listId={id}
          item={editing}
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          onRemoved={(item) => {
            setRemoved((last) => ({ item, n: (last?.n ?? 0) + 1 }));
          }}
          units={catalog.data.units}
          catalog={catalog.data}
        />
      )}
      {removed && (
        <UndoRemove key={removed.n} listId={id} item={removed.item} />
      )}
      <DeleteListsDialog
        lists={[{ id, name }]}
        open={deleting}
        onOpenChange={(open) => {
          setDeleting(open);
          // Stryker disable next-line ConditionalExpression: the dialog never calls onOpenChange(true), so `true` behaves as `!open`
          if (!open) askDelete.current = false;
        }}
        onDeleted={() => {
          deleted.current = true;
          void navigate("/", { replace: true, state: { deleted: true } });
        }}
      />
    </>
  );
}
