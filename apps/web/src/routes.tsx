import type { RouteObject } from "react-router";
import { HealthPage } from "./health/health-page.tsx";

// One table, used by the app and by the tests, so tests run the real routes.
export const routes: RouteObject[] = [{ path: "/", element: <HealthPage /> }];
