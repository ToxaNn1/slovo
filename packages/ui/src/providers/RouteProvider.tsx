import { createContext, useContext, type ReactNode } from 'react';

/** The route on screen, or none where no navigation is drawn (a test of a component alone). */
const RouteContext = createContext<string | undefined>(undefined);

/**
 * Gives every sheet below the route on screen, the app's path. A sheet belongs
 * to the route it opened on: when another route comes on screen (a link, a
 * notification tap or a tab), the sheet closes, or leaves until its route is
 * back if only its content closes it (`BottomSheet`).
 */
export function RouteProvider({ route, children }: { route: string; children: ReactNode }) {
  return <RouteContext value={route}>{children}</RouteContext>;
}

/** The route on screen, from the nearest `RouteProvider`; none without one. */
export function useRouteOnScreen(): string | undefined {
  return useContext(RouteContext);
}
