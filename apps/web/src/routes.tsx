import type { RouteObject } from "react-router";
import { DesignPage } from "./design/design-page.tsx";
import { AppShell } from "./shell/app-shell.tsx";
import { StartPage } from "./start/start-page.tsx";

// What a route tells the shell: the title of its page, shown as the h1 and
// in the tab.
export interface RouteHandle {
  title: string;
}

// One table, used by the app and by the tests, so tests run the real routes.
// Every page sits in the shell, a layout route without a path of its own.
export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <StartPage />,
        handle: { title: "Start" } satisfies RouteHandle,
      },
      {
        path: "design",
        element: <DesignPage />,
        handle: { title: "Design system" } satisfies RouteHandle,
      },
    ],
  },
];
