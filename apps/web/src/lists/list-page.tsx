import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router";
import { Button, buttonVariants } from "@/components/ui/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { cn } from "@/lib/utils.ts";
import { ApiRequestError } from "../api/client.ts";
import { DeleteListsDialog } from "./delete-lists-dialog.tsx";
import { EmptyList, ListHeader, TitleField } from "./list-screen.tsx";
import { useList, useRenameList } from "./use-lists.ts";

// /lists/:id: the list's screen. The shell leaves its header and the tab's
// title to this page.
export function ListPage() {
  // Stryker disable next-line StringLiteral: the route always supplies :id; the default only satisfies the type
  const { id = "" } = useParams();
  const query = useList(id);
  const rename = useRenameList(id);
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const queryClient = useQueryClient();
  const deleted = useRef(false);
  const askDelete = useRef(false);
  const actions = useRef<HTMLButtonElement>(null);

  // A deleted list leaves the cache once this screen no longer observes it:
  // removed earlier, it would be refetched (a 404) before the navigation lands.
  useEffect(
    () => () => {
      if (deleted.current) {
        queryClient.removeQueries({ queryKey: ["lists", id], exact: true });
      }
    },
    [queryClient, id],
  );
  const input = useRef<HTMLInputElement>(null);
  const renaming = useRef(false);
  const name = query.data?.name;

  useEffect(() => {
    document.title = name ? `${name} · Szop` : "Szop";
  }, [name]);

  if (query.error) {
    const missing =
      query.error instanceof ApiRequestError && query.error.status === 404;
    return (
      <>
        <ListHeader field={null} />
        <section className="mt-4 rounded-surface bg-card p-4 text-card-foreground">
          <h1 className="text-lg font-bold">
            {missing
              ? "This list does not exist."
              : "The list could not be loaded."}
          </h1>
          {missing ? (
            <Link
              to="/"
              // Stryker disable next-line ObjectLiteral,StringLiteral: class names only, no behavior; the 48 px tap target is checked in e2e
              className={cn(buttonVariants({ variant: "outline" }), "mt-4")}
            >
              Show my lists
            </Link>
          ) : (
            <>
              <p className="mt-1 text-muted-foreground">
                {query.error.message}
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  void query.refetch();
                }}
              >
                Try again
              </Button>
            </>
          )}
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
            {...(rename.error ? { error: rename.error.message } : {})}
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
                  ref={actions}
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
                // The dialog gets the focus, and gives it back to ⋮ itself.
                if (askDelete.current) return false;
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
      <EmptyList />
      <DeleteListsDialog
        lists={[{ id, name }]}
        open={deleting}
        onOpenChange={(open) => {
          setDeleting(open);
          if (!open) askDelete.current = false;
          // Stryker disable next-line OptionalChaining: the ref is set while ⋮ is mounted
          if (!open) actions.current?.focus();
        }}
        onDeleted={() => {
          deleted.current = true;
          void navigate("/", { replace: true });
        }}
      />
    </>
  );
}
