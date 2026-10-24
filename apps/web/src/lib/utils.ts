// shadcn/ui's class merger: joins class lists and lets a later Tailwind class
// win over an earlier one that sets the same thing ("px-2 px-4" → "px-4"),
// so a component's caller can override its classes (ADR 0013, decision 19).
// The cn package is shadcn's own, replacing clsx with tailwind-merge.
export { cn } from "cn";
