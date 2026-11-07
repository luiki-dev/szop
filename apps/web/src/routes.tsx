import { lazy, Suspense, type ReactNode } from "react";
import type { RouteObject } from "react-router";
import { CatalogPage } from "./catalog/catalog-page.tsx";
import { DesignPage } from "./design/design-page.tsx";
import { ListHeader } from "./lists/list-screen.tsx";
import { ListsPage, NewListLink } from "./lists/lists-page.tsx";
import { NewListPage } from "./lists/new-list-page.tsx";
import { NotFound } from "./not-found/not-found.tsx";
import { AppShell } from "./shell/app-shell.tsx";

// The list's screen is its own chunk (items, haul, edit sheet and their
// libraries), which keeps the entry chunk within the NFR-3.1 budget. While it
// loads, the page shows the same bare header as a list that is loading.
const ListPage = lazy(async () => ({
  default: (await import("./lists/list-page.tsx")).ListPage,
}));

// What a route tells the shell: the title of its page, shown as the h1 and
// in the tab; an action, shown beside the h1 on a desktop; and, for a page
// with a header of its own (a list), "list": the shell then draws neither
// its phone header nor its h1 and leaves the tab's title to the page.
export interface RouteHandle {
  title?: string;
  header?: "list";
  action?: ReactNode;
}

// One table, used by the app and by the tests, so tests run the real routes.
// Every page sits in the shell, a layout route without a path of its own.
export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <ListsPage />,
        handle: {
          title: "Lists",
          action: <NewListLink />,
        } satisfies RouteHandle,
      },
      {
        path: "lists/new",
        element: <NewListPage />,
        handle: { header: "list" } satisfies RouteHandle,
      },
      {
        path: "lists/:id",
        element: (
          <Suspense
            fallback={
              <>
                <h1 className="sr-only">List</h1>
                <ListHeader field={null} />
              </>
            }
          >
            <ListPage />
          </Suspense>
        ),
        handle: { header: "list" } satisfies RouteHandle,
      },
      {
        path: "catalog",
        element: <CatalogPage />,
        handle: { title: "Catalog" } satisfies RouteHandle,
      },
      {
        path: "design",
        element: <DesignPage />,
        handle: { title: "Design system" } satisfies RouteHandle,
      },
      {
        path: "*",
        element: <NotFound message="This page doesn't exist." />,
        handle: { title: "Not found" } satisfies RouteHandle,
      },
    ],
  },
];
