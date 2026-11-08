import { Toast } from "@base-ui/react/toast";
import { TriangleAlert } from "lucide-react";

// The one toast manager: hooks that are not components add toasts through it.
export const toastManager = Toast.createToastManager();

const notSaved = "Check your connection and try again.";

// A failure: the destructive color and a warning icon, announced at once
// (APP-3.4). Base UI reads a high-priority toast out in a role="alert" copy.
function showError(description: string): void {
  toastManager.add({ type: "error", priority: "high", description });
}

export function showNotSaved(name: string): void {
  showError(`${name} wasn't saved. ${notSaved}`);
}

// The sort setting has no item name.
export function showSortNotSaved(): void {
  showError(`Sorting wasn't saved. ${notSaved}`);
}

function ToastList() {
  const { toasts } = Toast.useToastManager();
  // A toast over the limit is kept, marked limited: it is not shown.
  return toasts
    .filter((toast) => !toast.limited)
    .map((toast) => (
      <Toast.Root
        key={toast.id}
        toast={toast}
        className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm shadow-lg ${
          toast.type === "error"
            ? "bg-destructive text-destructive-foreground"
            : "justify-between bg-foreground text-background"
        }`}
      >
        {toast.type === "error" && (
          <TriangleAlert aria-hidden="true" className="size-5.5 shrink-0" />
        )}
        <Toast.Description />
        {toast.actionProps && (
          <Toast.Action className="min-h-11 rounded-control px-3 font-semibold underline outline-none focus-visible:ring-3 focus-visible:ring-ring" />
        )}
      </Toast.Root>
    ));
}

// One toast at a time: a new one replaces the shown one. The viewport is a
// polite live region above the add bar and the haul, centered on the haul at
// 75% of its width on a phone and 60% from lg (#414); the list page sets
// --toast-offset, --haul-center and --haul-width, else the window's are used.
export function Toasts() {
  return (
    <Toast.Provider toastManager={toastManager} limit={1}>
      <Toast.Viewport className="fixed bottom-[calc(var(--toast-offset,5.25rem)+0.75rem)] left-[var(--haul-center,50%)] z-50 w-[calc(var(--haul-width,100vw)*0.75)] -translate-x-1/2 lg:w-[calc(var(--haul-width,100vw)*0.6)]">
        <ToastList />
      </Toast.Viewport>
    </Toast.Provider>
  );
}
