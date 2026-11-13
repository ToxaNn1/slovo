import { useLocalSearchParams } from 'expo-router';

/** The params of a route as Expo Router reads them from the URL: a repeated one comes as a list. */
type UrlParams = Readonly<Record<string, string | readonly string[] | undefined>>;

/** The param `name` of `params` as one string: the first of a repeated one; nothing when the URL lacks it. */
export function paramOf(params: UrlParams, name: string): string | undefined {
  const value = params[name];
  return typeof value === 'string' ? value : value?.[0];
}

/**
 * A param the route's URL may carry, such as `?from=`, parsed once at the
 * route's edge: nothing when the URL lacks it.
 */
export function useQueryParam(name: string): string | undefined {
  return paramOf(useLocalSearchParams(), name);
}

/**
 * The param of a path segment of the route, such as `[categoryId]`, which
 * Expo Router always fills: empty only on a URL the route can't match, which
 * no id is.
 */
export function useSegmentParam(name: string): string {
  return useQueryParam(name) ?? '';
}
