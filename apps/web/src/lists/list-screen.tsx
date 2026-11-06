import { ArrowDown, ArrowLeft } from "lucide-react";
import { useRef, useState, type ReactNode, type RefObject } from "react";
import { useIsMutating } from "@tanstack/react-query";
import { Link } from "react-router";
import { listNameSchema } from "@szop/shared";
import logo from "@/brand/logo.svg";
import raccoon from "@/brand/raccoon.svg";
import { Button, buttonVariants } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";
import { desktopQuery, useMediaQuery } from "../shell/use-media-query.ts";

// A bar pinned to the bottom of a phone's screen, within the thumb's reach,
// with a spacer that keeps the page's last item clear of it.
export function BottomBar({ children }: { children: ReactNode }) {
  return (
    <>
      {/* The button's 48 px and the bar's py-3. */}
      <div className="h-18" />
      <div className="fixed inset-x-0 bottom-0 mx-auto flex max-w-[720px] bg-background px-4 py-3 md:px-6">
        {children}
      </div>
    </>
  );
}

// The header of a list's screen, which stands in for the shell's: ← to the
// lists page, the name field, an optional ⋮ menu and the raccoon tile.
export function ListHeader({
  field,
  menu,
}: {
  field: ReactNode;
  menu?: ReactNode;
}) {
  // While a change is in flight ← looks and acts disabled; it stays a link, so
  // it keeps its place in the tab order.
  const busy = useIsMutating() > 0;
  return (
    <header className="-ml-2 flex items-start gap-3 pt-2 md:-ml-4 lg:ml-0 lg:pt-0">
      <Link
        to="/"
        aria-label="Back to lists"
        {...(busy ? { "aria-disabled": true } : {})}
        onClick={(event) => {
          if (busy) event.preventDefault();
        }}
        className={cn(
          // Stryker disable next-line ObjectLiteral: class names only, no behavior
          // Stryker disable next-line StringLiteral: class names only, no behavior
          buttonVariants({ variant: "ghost", size: "icon" }),
          // Stryker disable next-line StringLiteral: Tailwind class name: jsdom applies no CSS, so no test can tell the change apart
          "aria-disabled:opacity-50",
        )}
      >
        <ArrowLeft aria-hidden="true" />
      </Link>
      {/* -ml-3 puts the name where the shell's phone header puts its title. */}
      <div className="-ml-3 min-w-0 flex-1">{field}</div>
      {menu}
      {/* From lg the sidebar shows the same tile, so the header does not repeat it. */}
      <img
        src={logo}
        alt=""
        className="size-12 shrink-0 rounded-control lg:hidden"
      />
    </header>
  );
}

// The list's name: at rest it reads as the title, with a dotted underline as
// the only hint that it can be edited; focused it becomes a field. Enter
// saves, Esc puts the old name back, and, with saveOnBlur, so does leaving
// the field. An empty name is never saved. With create, the list does not
// exist yet: the field stays a bordered field, and a Create button does what
// Enter does (pinned at the bottom on a phone, beside the field on a desktop).
export function TitleField({
  initial,
  autoFocus,
  saveOnBlur,
  create,
  inputRef,
  pending,
  failed,
  error,
  onSave,
  onCancel,
}: {
  initial: string;
  autoFocus?: boolean;
  saveOnBlur?: boolean;
  create?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  pending: boolean;
  failed?: boolean;
  error?: string;
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [seen, setSeen] = useState(initial);
  const [tooLong, setTooLong] = useState<string>();
  const desktop = useMediaQuery(desktopQuery);
  const ownRef = useRef<HTMLInputElement>(null);
  const field = inputRef ?? ownRef;
  // Stryker disable next-line BooleanLiteral: onFocus resets it before any blur can happen, so the initial value is never read
  const cancelled = useRef(false);
  // The server's answer replaces what the field shows.
  if (seen !== initial) {
    setSeen(initial);
    setValue(initial);
  }

  function commit() {
    if (pending) return;
    const parsed = listNameSchema.safeParse(value);
    if (!parsed.success) {
      if (value.trim() === "") setValue(initial);
      else {
        // Stryker disable next-line OptionalChaining: a failed parse has at least one issue
        setTooLong(parsed.error.issues[0]?.message);
      }
      return;
    }
    setTooLong(undefined);
    if (parsed.data !== initial) onSave(parsed.data);
  }

  const valid = listNameSchema.safeParse(value);
  // With create, the reason Create is disabled shows as soon as it is typed.
  const live =
    create && value.trim() !== "" && !valid.success
      ? valid.error.issues[0]?.message
      : undefined;
  const message = tooLong ?? live ?? error;
  const createButton = create && (
    <Button
      disabled={pending || !valid.success}
      // Stryker disable next-line StringLiteral: Tailwind class name: jsdom applies no CSS, so no test can tell the change apart
      className={desktop ? "shrink-0" : "w-full"}
      onClick={commit}
    >
      {pending ? "Creating…" : "Create"}
    </Button>
  );
  const input = (
    <input
      ref={field}
      value={value}
      autoFocus={autoFocus}
      readOnly={pending}
      maxLength={100}
      placeholder="List name"
      aria-label="List name"
      aria-invalid={message ? true : undefined}
      className={cn(
        // Stryker disable next-line StringLiteral: Tailwind class name: jsdom applies no CSS, so no test can tell the change apart
        "h-12 w-full truncate rounded-control px-2 text-xl font-extrabold outline-none focus:ring-3 focus:ring-ring",
        create
          ? "border-2 border-input bg-card"
          : // Stryker disable next-line StringLiteral: Tailwind class name: jsdom applies no CSS, so no test can tell the change apart
            "bg-transparent underline decoration-input decoration-dotted decoration-2 underline-offset-2 placeholder:underline placeholder:decoration-input placeholder:decoration-dotted placeholder:decoration-2 placeholder:underline-offset-2 focus:bg-card focus:no-underline focus:placeholder:no-underline",
      )}
      onChange={(event) => {
        setValue(event.target.value);
      }}
      onFocus={() => {
        cancelled.current = false;
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit();
        if (event.key === "Escape" && !pending) {
          cancelled.current = true;
          setValue(initial);
          setTooLong(undefined);
          onCancel();
        }
      }}
      onBlur={() => {
        if (saveOnBlur && !cancelled.current && !failed) commit();
      }}
    />
  );
  return (
    <>
      {create && desktop ? (
        <div className="flex gap-2">
          {input}
          {createButton}
        </div>
      ) : (
        input
      )}
      {create && !desktop && <BottomBar>{createButton}</BottomBar>}
      {!create && pending && (
        <p className="px-2 pt-1 text-sm text-muted-foreground">Saving…</p>
      )}
      {!create && failed && (
        <p role="alert" className="px-2 pt-1 text-sm text-destructive">
          Not saved.{" "}
          <button
            type="button"
            className="inline-flex min-h-12 items-center rounded-control px-1 underline outline-none focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            onClick={() => {
              commit();
              // The button goes away while the retry runs: keep the focus.
              // Stryker disable next-line OptionalChaining: the ref is set while the field is mounted
              field.current?.focus();
            }}
          >
            Try again
          </button>
        </p>
      )}
      {message && (
        <p role="alert" className="px-2 pt-1 text-sm text-destructive">
          {message}
        </p>
      )}
    </>
  );
}

// The empty list's body. The raccoon peeks in from the left edge, halfway
// down, so the add bar of a later phase does not cover it; from lg, from under
// the sidebar's right edge (the sidebar is w-64 and paints over it). Only the
// top of its head shows, down to just below the eyes.
export function EmptyList() {
  return (
    <>
      <p className="mt-16 text-center text-xl font-semibold text-muted-foreground">
        Nothing on this list yet
      </p>
      <ArrowDown
        aria-hidden="true"
        className="mx-auto mt-3 size-6 text-muted-foreground"
      />
      <img
        src={raccoon}
        alt=""
        aria-hidden="true"
        width={200}
        height={200}
        className="pointer-events-none fixed top-1/2 -left-[65px] -z-10 -translate-y-1/2 rotate-90 opacity-55 grayscale lg:left-[calc(16rem-65px)]"
      />
    </>
  );
}
