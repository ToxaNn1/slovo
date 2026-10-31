import { useNavigationContainerRef, useRouter } from 'expo-router';
import { useCallback } from 'react';

/** The name of the Entry route in each stack of links, `entry/[entryId]` and `mood/[entryId]`. */
const entryRoute = '[entryId]';

/** A navigator's state as far as this file reads it: its key and its routes, each with its own. */
interface NavigatorState {
  readonly key?: string;
  readonly routes: readonly { readonly name: string; readonly state?: NavigatorState }[];
}

/** The navigator, at any depth, that holds a route named `name`, the tabs for a stack of links. */
function navigatorWith(
  state: NavigatorState | undefined,
  name: string,
): NavigatorState | undefined {
  if (state === undefined) return undefined;
  if (state.routes.some((route) => route.name === name)) return state;
  for (const route of state.routes) {
    const found = navigatorWith(route.state, name);
    if (found !== undefined) return found;
  }
  return undefined;
}

/**
 * Opens the Entry of a link, `/<stack>/<id>?<params>`, in place of whatever
 * its stack of links (`/entry` or `/mood`) holds: the Entry open on it, a
 * Correction over that Entry, or the Entry the reader left with «Назад»,
 * which the stack keeps out of sight. The stack is left with the new Entry
 * alone and comes to the front, so one «Назад» returns to where the reader
 * was before it, the Feed. A stack never opened takes the Entry on top of the
 * screen the reader is on.
 */
export function useReplaceOpenEntry(): (link: string) => void {
  const router = useRouter();
  const navigation = useNavigationContainerRef();
  return useCallback(
    (link: string) => {
      const [path = '', search = ''] = link.split('?');
      const [, stackName = '', entryId = ''] = path.split('/');
      const tabs = navigatorWith(navigation.getRootState(), stackName);
      const stack = tabs?.routes.find((route) => route.name === stackName)?.state;
      if (tabs?.key === undefined || stack?.key === undefined) {
        router.push(link);
        return;
      }
      const params = {
        ...Object.fromEntries(new URLSearchParams(search)),
        entryId: decodeURIComponent(entryId),
      };
      navigation.dispatch({
        type: 'RESET',
        payload: { index: 0, routes: [{ name: entryRoute, params }] },
        target: stack.key,
      });
      navigation.dispatch({ type: 'NAVIGATE', payload: { name: stackName }, target: tabs.key });
    },
    [navigation, router],
  );
}
