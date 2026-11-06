import { Toast } from "@base-ui/react/toast";

// The one toast manager: hooks that are not components add toasts through it.
export const toastManager = Toast.createToastManager();

const notSaved = "Check your connection and try again.";

export function showNotSaved(name: string): void {
  toastManager.add({ description: `${name} wasn't saved. ${notSaved}` });
}

// The sort setting has no item name.
export function showSortNotSaved(): void {
  toastManager.add({ description: `Sorting wasn't saved. ${notSaved}` });
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
        className="rounded-lg bg-foreground px-4 py-3 text-sm text-background shadow-lg"
      >
        <Toast.Description />
      </Toast.Root>
    ));
}

// One toast at a time: a new one replaces the shown one. The viewport is a
// polite live region, centered at 75% of the width, above the add bar.
export function Toasts() {
  return (
    <Toast.Provider toastManager={toastManager} limit={1}>
      <Toast.Viewport className="fixed bottom-24 left-1/2 z-50 w-3/4 -translate-x-1/2">
        <ToastList />
      </Toast.Viewport>
    </Toast.Provider>
  );
}
