import { Check } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils.ts";

// The card every registration page sits in: 400 px at most on a desktop, in
// the design system's form style (visual-design.md, "The registration pages").
export function FormCard({
  children,
  ...props
}: { children: ReactNode } & React.ComponentProps<"form">) {
  return (
    <form
      noValidate
      className="mx-auto flex w-full max-w-100 flex-col gap-3 rounded-surface bg-card p-4 text-card-foreground"
      {...props}
    >
      {children}
    </form>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-100 flex-col gap-3 rounded-surface bg-card p-4 text-card-foreground">
      {children}
    </div>
  );
}

// A labelled field, its hint and its error under it. A password field gets a
// Show button; `name` tells the two Show buttons apart for a screen reader.
export function Field({
  label,
  hint,
  error,
  secret,
  value,
  onChange,
  onBlur,
  ...props
}: {
  label: string;
  hint?: string;
  error?: string | undefined;
  secret?: boolean;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
} & Omit<React.ComponentProps<"input">, "onChange" | "onBlur" | "value">) {
  const id = useId();
  const [shown, setShown] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={secret && !shown ? "password" : "text"}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          onBlur={onBlur}
          aria-invalid={error ? true : undefined}
          aria-describedby={hint || error ? `${id}-note` : undefined}
          className={cn(
            "min-h-12 w-full rounded-control border-2 border-input bg-card px-3 text-base text-card-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring aria-invalid:border-destructive",
            secret && "pr-20",
          )}
          {...props}
        />
        {secret && (
          <button
            type="button"
            aria-label={`${shown ? "Hide" : "Show"} ${label.toLowerCase()}`}
            aria-pressed={shown}
            onClick={() => {
              setShown(!shown);
            }}
            className="absolute inset-y-0 right-1 min-w-12 rounded-control px-2 text-sm font-semibold text-link outline-none focus-visible:ring-3 focus-visible:ring-ring"
          >
            {shown ? "Hide" : "Show"}
          </button>
        )}
      </div>
      <div id={`${id}-note`}>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        {error && (
          <p className="mt-1 text-xs font-semibold text-destructive">{error}</p>
        )}
      </div>
    </div>
  );
}

// A ticked box with a check mark, as the mockup draws it.
export function Tick({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="relative flex size-6 shrink-0 items-center justify-center">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(event) => {
            onChange(event.target.checked);
          }}
          aria-describedby={`${id}-hint`}
          className="peer size-6 shrink-0 cursor-pointer appearance-none rounded-md border-2 border-input outline-none checked:border-primary checked:bg-primary focus-visible:ring-3 focus-visible:ring-ring"
        />
        <Check
          aria-hidden="true"
          className="pointer-events-none absolute size-4 text-primary-foreground opacity-0 peer-checked:opacity-100"
        />
      </span>
      <div>
        <label htmlFor={id} className="font-bold">
          {label}
        </label>
        <p id={`${id}-hint`} className="text-muted-foreground">
          {hint}
        </p>
      </div>
    </div>
  );
}
