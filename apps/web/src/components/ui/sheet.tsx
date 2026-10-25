import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";

// Copied in by shadcn/ui (style base-nova) and kept to what Szop uses: a
// modal panel from the left on Base UI's Dialog, which traps focus, closes on
// Esc and on the backdrop, and returns focus to its trigger. Restyled to the
// roles; it slides only when the system allows motion (visual-design.md,
// section 5).
function Sheet(props: SheetPrimitive.Root.Props) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger(props: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetContent({
  className,
  children,
  closeLabel = "Close",
  ...props
}: SheetPrimitive.Popup.Props & { closeLabel?: string }) {
  return (
    <SheetPrimitive.Portal data-slot="sheet-portal">
      <SheetPrimitive.Backdrop
        data-slot="sheet-overlay"
        className="fixed inset-0 z-50 bg-black/40 data-ending-style:opacity-0 data-starting-style:opacity-0 motion-safe:transition-opacity motion-safe:duration-200"
      />
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-full flex-col border-r border-border bg-card text-card-foreground shadow-lg outline-none data-ending-style:-translate-x-full data-starting-style:-translate-x-full motion-safe:transition motion-safe:duration-200 motion-safe:ease-out",
          className,
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close
          data-slot="sheet-close"
          render={
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2"
            />
          }
        >
          <XIcon aria-hidden="true" />
          <span className="sr-only">{closeLabel}</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Popup>
    </SheetPrimitive.Portal>
  );
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-base font-semibold", className)}
      {...props}
    />
  );
}

export { Sheet, SheetContent, SheetTitle, SheetTrigger };
