import {
  Check,
  Menu,
  Plus,
  ShoppingBag,
  Trash2,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";
import { colorRoles } from "./roles.ts";

// The palette itself, the one place a component shows raw palette colors
// (visual-design.md, section 3).
const palette = [
  { name: "fur", className: "bg-fur" },
  { name: "sage-100", className: "bg-sage-100" },
  { name: "sage-300", className: "bg-sage-300" },
  { name: "sage-500", className: "bg-sage-500" },
  { name: "sage-700", className: "bg-sage-700" },
  { name: "sage-800", className: "bg-sage-800" },
  { name: "sage-950", className: "bg-sage-950" },
];

const icons: { name: string; Icon: LucideIcon }[] = [
  { name: "Menu", Icon: Menu },
  { name: "Plus", Icon: Plus },
  { name: "Check", Icon: Check },
  { name: "Trash", Icon: Trash2 },
  { name: "Undo", Icon: Undo2 },
  { name: "Shopping bag", Icon: ShoppingBag },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

// Szop's tokens and first components, in the current color scheme, for
// checking the styles in the browser (ADR 0048).
export function DesignPage() {
  return (
    <main className="mx-auto max-w-[720px] px-4 py-6">
      <Link to="/" className="font-semibold text-link underline">
        ← Back
      </Link>
      <h1 className="mt-4 text-2xl font-extrabold">Design system</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Szop's tokens and components, in the current color scheme.
      </p>

      <Section title="Colors">
        <ul className="grid grid-cols-3 gap-2">
          {colorRoles.map((role) => (
            <li key={role.name} data-role={role.name} className="text-xs">
              <div
                className={cn(
                  "flex h-12 items-center justify-center rounded-control border border-border text-base font-semibold",
                  role.className,
                  role.foreground?.className,
                )}
              >
                {role.foreground ? "Aa" : null}
              </div>
              <p className="mt-1 break-words">
                {role.name}
                {role.foreground ? ` / ${role.foreground.name}` : null}
              </p>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          <Link to="/design" className="text-link underline">
            A link on the page
          </Link>
          <span className="rounded-control bg-card px-2">
            <Link to="/design" className="text-link underline">
              A link on a card
            </Link>
          </span>
        </div>
        <ul className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
          {palette.map((color) => (
            <li key={color.name} className="flex items-center gap-1">
              <span
                aria-hidden="true"
                className={cn(
                  "size-4 rounded-full border border-border",
                  color.className,
                )}
              />
              {color.name}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Type">
        <div className="rounded-surface bg-card p-4 text-card-foreground">
          <p className="text-2xl font-extrabold">Screen title 800</p>
          <p className="mt-1 text-lg font-bold">Heading 700</p>
          <p className="mt-1 font-semibold">Label 600</p>
          <p className="mt-1">Body 400 · Żółć ąę</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Smallest text, 12 px
          </p>
          <p className="mt-2 tabular-nums">€28.47 · 1,111.00 · 3 × 0.5 kg</p>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap gap-2">
          <Button>Primary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Delete</Button>
          <Button data-focused="">Focused</Button>
        </div>
      </Section>

      <Section title="Icons">
        <ul className="flex flex-wrap gap-4">
          {icons.map(({ name, Icon }) => (
            <li key={name} className="flex flex-col items-center gap-1 text-xs">
              <Icon aria-hidden="true" className="size-6" />
              {name}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Shape">
        <div className="rounded-surface bg-card p-4 text-sm text-card-foreground">
          Card · 18 px radius
          <p className="text-muted-foreground">Buttons and inputs 12 px</p>
        </div>
        <div className="mt-2 rounded-t-[24px] bg-haul px-4 py-3 text-sm text-haul-foreground">
          Haul · 24 px top corners
        </div>
      </Section>
    </main>
  );
}
