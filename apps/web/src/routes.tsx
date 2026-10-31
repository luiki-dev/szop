import type { ReactNode } from "react";
import type { RouteObject } from "react-router";
import { CatalogPage } from "./catalog/catalog-page.tsx";
import { DesignPage } from "./design/design-page.tsx";
import { ListPage } from "./lists/list-page.tsx";
import { ListsPage, NewListLink } from "./lists/lists-page.tsx";
import { NewListPage } from "./lists/new-list-page.tsx";
import { AppShell } from "./shell/app-shell.tsx";

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
        element: <ListPage />,
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
    ],
  },
];
