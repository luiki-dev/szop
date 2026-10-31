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
    <header className="flex items-start gap-1 pt-2">
      <Link
        to="/"
        aria-label="Back to lists"
        className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
      >
        <ArrowLeft aria-hidden="true" />
      </Link>
      <div className="min-w-0 flex-1">{field}</div>
      {menu}
      <img src={logo} alt="" className="size-10 shrink-0 rounded-control" />
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
      else setTooLong(parsed.error.issues[0]?.message);
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
        className="h-10 w-full truncate rounded-control border-b-2 border-dotted border-input bg-transparent px-2 text-xl font-extrabold outline-none focus:border-transparent focus:bg-card focus:ring-3 focus:ring-ring"
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
// right edge. Only the top of its head shows: up to 5 px below the eyes.
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
        className="pointer-events-none fixed top-1/2 -left-[85px] -z-10 -translate-y-1/2 rotate-90 opacity-55 grayscale lg:-right-[85px] lg:left-auto lg:-rotate-90"
      />
    </>
  );
}
