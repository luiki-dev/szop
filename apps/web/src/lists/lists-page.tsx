import { Plus } from "lucide-react";
import { Link } from "react-router";
import raccoon from "@/brand/raccoon.svg";
import { Button, buttonVariants } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";
import { desktopQuery, useMediaQuery } from "../shell/use-media-query.ts";
import { useLists } from "./use-lists.ts";

// On a phone the link fills a bar at the bottom of the screen, within the
// thumb's reach; on a desktop the shell shows it beside the h1.
export function NewListLink({ sticky }: { sticky?: boolean }) {
  const link = (
    // Stryker disable next-line StringLiteral: class names only, no behavior
    <Link
      to="/lists/new"
      className={cn(buttonVariants(), "gap-2", sticky && "w-full")}
    >
      <Plus aria-hidden="true" />
      New list
    </Link>
  );
  return sticky ? (
    <>
      {/* Keeps the last card clear of the bar: the button's 48 px and py-3. */}
      <div className="h-18" />
      <div className="fixed inset-x-0 bottom-0 mx-auto flex max-w-[720px] bg-background px-4 py-3 md:px-6">
        {link}
      </div>
    </>
  ) : (
    link
  );
}

function Skeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-3">
      {[0, 1, 2].map((card) => (
        <div
          key={card}
          data-testid="skeleton-card"
          className="h-14 rounded-surface bg-card motion-safe:animate-pulse"
        />
      ))}
    </div>
  );
}

// The lists page at /: the home screen. The shell gives it its title and,
// on a desktop, the New list link.
export function ListsPage() {
  const query = useLists();
  const desktop = useMediaQuery(desktopQuery);

  if (query.isError) {
    return (
      <>
        <section className="mt-4 rounded-surface bg-card p-4 text-card-foreground">
          <h2 className="text-lg font-bold">The lists could not be loaded.</h2>
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
        {!desktop && <NewListLink sticky />}
      </>
    );
  }

  const lists = query.data;
  return (
    <>
      <div className="mt-4 flex min-w-0 flex-col gap-3">
        {!lists ? (
          <Skeleton />
        ) : lists.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <img
              src={raccoon}
              alt=""
              width={120}
              height={120}
              className="opacity-55 grayscale"
            />
            <p className="text-xl font-semibold text-muted-foreground">
              Create your first list
            </p>
          </div>
        ) : (
          <ul className="flex min-w-0 flex-col gap-3">
            {lists.map((list) => (
              <li key={list.id} className="min-w-0">
                <Link
                  to={`/lists/${list.id}`}
                  className="flex min-h-12 min-w-0 items-center rounded-surface bg-card px-4 font-semibold text-card-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring"
                >
                  <span className="truncate">{list.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      {!desktop && <NewListLink sticky />}
    </>
  );
}
