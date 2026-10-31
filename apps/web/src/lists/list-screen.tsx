import { ArrowLeft } from "lucide-react";
import { useRef, useState, type ReactNode, type Ref } from "react";
import { Link } from "react-router";
import { listNameSchema } from "@szop/shared";
import logo from "@/brand/logo.svg";
import raccoon from "@/brand/raccoon.svg";
import { buttonVariants } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";

// The header of a list's screen, which stands in for the shell's: ← to the
// lists page, the name field, an optional ⋮ menu and the raccoon tile.
export function ListHeader({
  field,
  menu,
}: {
  field: ReactNode;
  menu?: ReactNode;
}) {
  return (
    <header className="-ml-2 flex items-start gap-3 pt-2 md:-ml-4 lg:ml-0 lg:pt-0">
      <Link
        to="/"
        aria-label="Back to lists"
        // Stryker disable next-line ObjectLiteral,StringLiteral: class names only, no behavior
        className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
      >
        <ArrowLeft aria-hidden="true" />
      </Link>
      {/* -ml-3 puts the name where the shell's phone header puts its title. */}
      <div className="-ml-3 min-w-0 flex-1">{field}</div>
      {menu}
      <img src={logo} alt="" className="size-12 shrink-0 rounded-control" />
    </header>
  );
}

// The list's name: at rest it reads as the title, with a dotted underline as
// the only hint that it can be edited; focused it becomes a field. Enter
// saves, Esc puts the old name back, and, with saveOnBlur, so does leaving
// the field. An empty name is never saved.
export function TitleField({
  initial,
  autoFocus,
  saveOnBlur,
  inputRef,
  pending,
  error,
  onSave,
  onCancel,
}: {
  initial: string;
  autoFocus?: boolean;
  saveOnBlur?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  pending: boolean;
  error?: string;
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [seen, setSeen] = useState(initial);
  const [tooLong, setTooLong] = useState<string>();
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

  const message = tooLong ?? error;
  return (
    <>
      <input
        ref={inputRef}
        value={value}
        autoFocus={autoFocus}
        readOnly={pending}
        placeholder="List name"
        aria-label="List name"
        aria-invalid={message ? true : undefined}
        className="h-12 w-full truncate rounded-control bg-transparent px-2 text-xl font-extrabold underline decoration-input decoration-dotted decoration-2 underline-offset-2 outline-none placeholder:underline placeholder:decoration-input placeholder:decoration-dotted placeholder:decoration-2 placeholder:underline-offset-2 focus:bg-card focus:no-underline focus:ring-3 focus:ring-ring focus:placeholder:no-underline"
        onChange={(event) => {
          setValue(event.target.value);
        }}
        onFocus={() => {
          cancelled.current = false;
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
          if (event.key === "Escape") {
            cancelled.current = true;
            setValue(initial);
            setTooLong(undefined);
            onCancel();
          }
        }}
        onBlur={() => {
          if (saveOnBlur && !cancelled.current) commit();
        }}
      />
      {message && (
        <p role="alert" className="px-2 pt-1 text-sm text-destructive">
          {message}
        </p>
      )}
    </>
  );
}

// The empty list's body. The raccoon peeks in from the left edge, halfway
// down, so the add bar of a later phase does not cover it; from lg, from the
// right edge. Only the top of its head shows, down to just below the eyes.
export function EmptyList() {
  return (
    <>
      <p className="mt-16 text-center text-xl font-semibold text-muted-foreground">
        Nothing on this list yet
      </p>
      <img
        src={raccoon}
        alt=""
        aria-hidden="true"
        width={200}
        height={200}
        className="pointer-events-none fixed top-1/2 -left-[65px] -z-10 -translate-y-1/2 rotate-90 opacity-55 grayscale lg:-right-[65px] lg:left-auto lg:-rotate-90"
      />
    </>
  );
}
