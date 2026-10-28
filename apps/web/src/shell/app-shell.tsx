import { Menu as MenuIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Outlet, ScrollRestoration, useMatches } from "react-router";
import { Button } from "@/components/ui/button.tsx";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet.tsx";
import type { RouteHandle } from "../routes.tsx";
import { Menu } from "./menu.tsx";
import { desktopQuery, useMediaQuery } from "./use-media-query.ts";

function isRouteHandle(handle: unknown): handle is RouteHandle {
  return (
    typeof handle === "object" &&
    handle !== null &&
    typeof (handle as { title?: unknown }).title === "string"
  );
}

// The title of the deepest route that names one.
function usePageTitle(): string | undefined {
  const matches = useMatches();
  return matches
    .map((match) => match.handle)
    .filter(isRouteHandle)
    .at(-1)?.title;
}

// The phone's header bar: ☰ and the page's title, with the menu in a
// drawer. Its open state lives here, so it goes when the screen grows past
// lg and the drawer never reopens by itself when it shrinks again.
function PhoneHeader({ title }: { title: string | undefined }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
      <header className="flex items-center gap-2 px-2 pt-2">
        <SheetTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label="Open menu"
              className="shrink-0 text-foreground"
            />
          }
        >
          <MenuIcon aria-hidden="true" />
        </SheetTrigger>
        <h1 className="min-w-0 truncate text-xl font-extrabold">{title}</h1>
      </header>
      <SheetContent closeLabel="Close menu" className="w-[280px] max-w-[85vw]">
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <nav aria-label="Menu" className="h-full overflow-y-auto">
          <Menu
            onNavigate={() => {
              setMenuOpen(false);
            }}
          />
        </nav>
      </SheetContent>
    </Sheet>
  );
}

// The app shell around every page (ADR 0013, decision 17; ADR 0049): on a
// phone a header bar with ☰ and a drawer, from lg a permanent sidebar. Only
// one of the two is rendered, so the menu is never in the page twice. The
// shell owns the page's h1 and the tab's title. The page's <main> keeps its
// place in the tree whichever chrome surrounds it, so crossing lg (a tablet
// rotating) does not rebuild the page and lose what it holds.
export function AppShell() {
  const desktop = useMediaQuery(desktopQuery);
  const title = usePageTitle();

  useEffect(() => {
    document.title = title ? `${title} · Szop` : "Szop";
  }, [title]);

  return (
    <div className={desktop ? "flex min-h-dvh" : undefined}>
      {desktop ? (
        <aside className="sticky top-0 h-dvh w-64 shrink-0 overflow-y-auto bg-card text-card-foreground">
          <nav aria-label="Menu" className="h-full">
            <Menu />
          </nav>
        </aside>
      ) : (
        <PhoneHeader title={title} />
      )}
      <main
        className={
          desktop
            ? "mx-auto w-full max-w-[720px] px-6 py-6"
            : "mx-auto max-w-[720px] px-4 pb-6 md:px-6"
        }
      >
        {desktop && <h1 className="text-2xl font-extrabold">{title}</h1>}
        <Outlet />
      </main>
      {/* A new page starts at the top; Back and Forward restore the scroll. */}
      <ScrollRestoration />
    </div>
  );
}
