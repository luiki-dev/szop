import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { itemCards, listSchema, orderCategories } from "@szop/shared";
import { useNavigate, useParams } from "react-router";
import { Button } from "@/components/ui/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { useCatalog } from "../catalog/use-catalog.ts";
import { ApiRequestError, notSaved } from "../api/client.ts";
import { NotFound } from "../not-found/not-found.tsx";
import { DeleteListsDialog } from "./delete-lists-dialog.tsx";
import { AddBar } from "./items/add-bar.tsx";
import { ItemCards, ItemCardsSkeleton } from "./items/item-cards.tsx";
import { EmptyList, ListHeader, TitleField } from "./list-screen.tsx";
import { useList, useRenameList } from "./use-lists.ts";

// /lists/:id: the list's screen. The shell leaves its header and the tab's
// title to this page.
export function ListPage() {
  // Stryker disable next-line StringLiteral: the route always supplies :id; the default only satisfies the type
  const { id = "" } = useParams();
  // An address that is not a list ID never reaches the API.
  const valid = listSchema.shape.id.safeParse(id).success;
  const query = useList(id, valid);
  const catalog = useCatalog();
  const rename = useRenameList(id);
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const queryClient = useQueryClient();
  const deleted = useRef(false);
  const askDelete = useRef(false);

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
            cards={cards}
            units={catalog.data.units}
            // The edit sheet comes with Task 7.
            onEdit={() => undefined}
          />
        </>
      )}
      {/* The haul folds while the field has the focus: Task 8. */}
      <AddBar listId={id} listName={name} onFocusChange={() => undefined} />
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
