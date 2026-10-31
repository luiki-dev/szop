import { MoreVertical, Pencil } from "lucide-react";
import { useEffect, useRef } from "react";
import { Link, useParams } from "react-router";
import { Button, buttonVariants } from "@/components/ui/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { cn } from "@/lib/utils.ts";
import { ApiRequestError } from "../api/client.ts";
import { EmptyList, ListHeader, TitleField } from "./list-screen.tsx";
import { useList, useRenameList } from "./use-lists.ts";

// /lists/:id: the list's screen. The shell leaves its header and the tab's
// title to this page.
export function ListPage() {
  // Stryker disable next-line StringLiteral: the route always supplies :id; the default only satisfies the type
  const { id = "" } = useParams();
  const query = useList(id);
  const rename = useRenameList(id);
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
          <DropdownMenu>
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
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
      <EmptyList />
    </>
  );
}
