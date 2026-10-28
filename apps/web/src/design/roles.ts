// Stryker disable all: the colour-role table: class names and labels, no logic
// The color roles of index.css that /design shows, one swatch each, with the
// text role that goes on it where there is one. The class names are written
// out in full, so Tailwind finds them in the source. A new role is added
// here too, and design-page.test.tsx checks the page shows every entry.
export interface ColorRole {
  name: string;
  className: string;
  foreground?: { name: string; className: string };
}

export const colorRoles: readonly ColorRole[] = [
  {
    name: "background",
    className: "bg-background",
    foreground: { name: "foreground", className: "text-foreground" },
  },
  {
    name: "card",
    className: "bg-card",
    foreground: { name: "card-foreground", className: "text-card-foreground" },
  },
  {
    name: "primary",
    className: "bg-primary",
    foreground: {
      name: "primary-foreground",
      className: "text-primary-foreground",
    },
  },
  {
    name: "accent",
    className: "bg-accent",
    foreground: {
      name: "accent-foreground",
      className: "text-accent-foreground",
    },
  },
  { name: "muted", className: "bg-muted" },
  { name: "muted-foreground", className: "bg-muted-foreground" },
  { name: "border", className: "bg-border" },
  { name: "input", className: "bg-input" },
  { name: "ring", className: "bg-ring" },
  { name: "link", className: "bg-link" },
  {
    name: "destructive",
    className: "bg-destructive",
    foreground: {
      name: "destructive-foreground",
      className: "text-destructive-foreground",
    },
  },
  {
    name: "warning",
    className: "bg-warning",
    foreground: {
      name: "warning-foreground",
      className: "text-warning-foreground",
    },
  },
  {
    name: "haul",
    className: "bg-haul",
    foreground: { name: "haul-foreground", className: "text-haul-foreground" },
  },
  { name: "haul-muted", className: "bg-haul-muted" },
  { name: "haul-chip", className: "bg-haul-chip" },
  { name: "haul-accent", className: "bg-haul-accent" },
];
