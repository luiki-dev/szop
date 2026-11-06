import { Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import type { List } from "@szop/shared";
import raccoon from "@/brand/raccoon.svg";
import { Button, buttonVariants } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";
import {
  coarseQuery,
  desktopQuery,
  useMediaQuery,
} from "../shell/use-media-query.ts";
import { BottomBar } from "./list-screen.tsx";
import { DeleteListsDialog } from "./delete-lists-dialog.tsx";
import { useLists } from "./use-lists.ts";
import { useLongPress } from "./use-long-press.ts";

// On a phone the link fills a bar at the bottom of the screen, within the
// thumb's reach; on a desktop the shell shows it beside the h1.
export function NewListLink({ sticky }: { sticky?: boolean }) {
  const link = (
    // Stryker disable next-line StringLiteral: class names only, no behavior
    <Link
      to="/lists/new"
      // Stryker disable next-line StringLiteral: Tailwind class name: jsdom applies no CSS, so no test can tell the change apart
      // Stryker disable next-line ConditionalExpression: a Tailwind class chosen by a flag, jsdom applies no CSS
      // Stryker disable next-line LogicalOperator: a Tailwind class chosen by a flag, jsdom applies no CSS
      className={cn(buttonVariants(), "gap-2", sticky && "w-full")}
    >
      <Plus aria-hidden="true" />
      New list
    </Link>
  );
  return sticky ? <BottomBar>{link}</BottomBar> : link;
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

// Selecting is held in the history entry's state: starting it pushes an
// entry, so Back stops it without leaving the page, and every other way out
// pops that entry again.
export function isSelecting(state: unknown): boolean {
  return (
    typeof state === "object" &&
    state !== null &&
    "selecting" in state &&
    state.selecting === true
  );
}

// A list's row: a link, or while selecting a label around a checkbox, so a
// tap anywhere on it toggles. On a touch screen a long press starts selecting.
function ListRow({
  list,
  selecting,
  checked,
  coarse,
  onLongPress,
  onToggle,
}: {
  list: List;
  selecting: boolean;
  checked: boolean;
  coarse: boolean;
  onLongPress: () => void;
  onToggle: () => void;
}) {
  const press = useLongPress(onLongPress, { disabled: selecting });
  const row =
    // Stryker disable next-line StringLiteral: Tailwind class name: jsdom applies no CSS, so no test can tell the change apart
    "flex min-h-12 min-w-0 items-center rounded-surface bg-card px-4 font-semibold text-card-foreground outline-none";
  return (
    <li
      className="min-w-0"
      {...(coarse ? press.handlers : {})}
      // The click that ends a long press must neither open nor toggle the row.
      onClickCapture={(event) => {
        if (!press.pressed()) return;
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      {selecting ? (
        <label
          className={cn(
            row,
            // Stryker disable next-line StringLiteral: Tailwind class name: jsdom applies no CSS, so no test can tell the change apart
            "cursor-pointer gap-3 has-checked:ring-2 has-checked:ring-primary has-focus-visible:ring-3 has-focus-visible:ring-ring",
          )}
        >
          <input
            type="checkbox"
            checked={checked}
            onChange={onToggle}
            className="size-5 shrink-0 accent-primary"
          />
          <span className="truncate">{list.name}</span>
        </label>
      ) : (
        <Link
          to={`/lists/${list.id}`}
          className={cn(
            row,
            // Stryker disable next-line StringLiteral: Tailwind class name: jsdom applies no CSS, so no test can tell the change apart
            "focus-visible:ring-3 focus-visible:ring-ring",
            // No text selection or callout menu on a long press.
            // Stryker disable next-line StringLiteral: Tailwind class name: jsdom applies no CSS, so no test can tell the change apart
            "select-none [-webkit-touch-callout:none]",
          )}
        >
          <span className="truncate">{list.name}</span>
        </Link>
      )}
    </li>
  );
}

// The lists page at /: the home screen. The shell gives it its title and,
// on a desktop, the New list link.
export function ListsPage() {
  const query = useLists();
  const desktop = useMediaQuery(desktopQuery);
  const coarse = useMediaQuery(coarseQuery);
  const navigate = useNavigate();
  const loc = useLocation();
  const selecting = isSelecting(loc.state);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [byLongPress, setByLongPress] = useState(false);
  // Stryker disable next-line ArrayDeclaration: confirming is set before the dialog opens
  const [confirming, setConfirming] = useState<Pick<List, "id" | "name">[]>([]);
  const [asking, setAsking] = useState(false);

  // One Back per selecting: a repeated Esc or a double tap must not leave the page.
  // Stryker disable next-line BooleanLiteral: the effect on [selecting] resets it on mount
  const stopped = useRef(false);
  const stop = () => {
    if (stopped.current) return;
    stopped.current = true;
    void navigate(-1);
  };
  useEffect(() => {
    stopped.current = false;
  }, [selecting]);
  // Whenever selecting ends, whichever way, what it held is cleared.
  const [wasSelecting, setWasSelecting] = useState(selecting);
  if (wasSelecting !== selecting) {
    setWasSelecting(selecting);
    if (!selecting) {
      setSelected(new Set());
      setByLongPress(false);
      setAsking(false);
    }
  }
  // After a delete the opener is gone, so the focus moves to the page title:
  // from a list's page (location state), or when selecting ends here.
  const refocus = useRef(false);
  useEffect(() => {
    const fromList =
      typeof loc.state === "object" &&
      loc.state !== null &&
      "deleted" in loc.state;
    if (selecting || !(refocus.current || fromList)) return;
    refocus.current = false;
    document.querySelector("h1")?.focus();
    // loc.state only matters when the page mounts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecting]);
  useEffect(() => {
    if (!selecting || asking) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.repeat) stop();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
    // stop only wraps the stable navigate
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecting, asking]);

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
  // A selected list that a refetch dropped is not counted.
  // Stryker disable next-line ArrayDeclaration: a non-list entry is filtered out the same as no entry
  const chosen = (lists ?? []).filter((list) => selected.has(list.id));
  const allChosen = lists !== undefined && chosen.length === lists.length;
  const start = (id?: string) => {
    void navigate("/", { state: { selecting: true } });
    if (id) {
      setSelected(new Set([id]));
      setByLongPress(true);
    }
  };
  const toggle = (id: string) => {
    const next = new Set(chosen.map((list) => list.id));
    if (!next.delete(id)) next.add(id);
    setSelected(next);
    if (next.size === 0 && byLongPress) stop();
  };
  return (
    <>
      {selecting && lists ? (
        <div className="mt-4 flex min-h-12 items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Cancel selection"
            onClick={stop}
          >
            <X aria-hidden="true" />
          </Button>
          <p aria-live="polite" className="min-w-0 flex-1 font-bold">
            {chosen.length} selected
          </p>
          <Button
            variant="ghost"
            onClick={() => {
              setSelected(
                allChosen ? new Set() : new Set(lists.map((list) => list.id)),
              );
            }}
          >
            {allChosen ? "Deselect all" : "Select all"}
          </Button>
          <Button
            variant="destructive"
            disabled={chosen.length === 0}
            onClick={() => {
              setConfirming(chosen);
              setAsking(true);
            }}
          >
            Delete
          </Button>
        </div>
      ) : lists && lists.length > 0 ? (
        <div className="mt-4 flex justify-end">
          <Button
            variant="outline"
            onClick={() => {
              start();
            }}
          >
            Select
          </Button>
        </div>
      ) : null}
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
              <ListRow
                key={list.id}
                list={list}
                selecting={selecting}
                checked={selected.has(list.id)}
                coarse={coarse}
                onLongPress={() => {
                  start(list.id);
                }}
                onToggle={() => {
                  toggle(list.id);
                }}
              />
            ))}
          </ul>
        )}
      </div>
      {!desktop && !selecting && <NewListLink sticky />}
      <DeleteListsDialog
        lists={confirming}
        open={asking}
        onOpenChange={setAsking}
        onDeleted={() => {
          refocus.current = true;
          stop();
        }}
      />
    </>
  );
}
