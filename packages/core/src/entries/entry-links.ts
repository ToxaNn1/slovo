/**
 * The links to an Entry: the one format of the link a notification and the
 * home-screen widget open (`/entry/<id>?from=<source>`), and what each source
 * marks. A notification's or the widget's link opens its Entry as Seen and
 * puts it in History (`Composition.openedFromNotification`, `Widget.opened`);
 * a plain link marks nothing. The widget's Swift writes the same link with
 * the app's scheme, its key and the Edition (ADR 0026).
 */

/** Where outside the app an Entry link opened from: a notification or the home-screen widget. */
export type EntryLinkSource = 'notification' | 'widget';

const SOURCES: readonly EntryLinkSource[] = ['notification', 'widget'];

/** An Entry link: the Entry it opens and where it opened from, or nothing for a plain link. */
export interface EntryLink {
  readonly entryId: string;
  readonly source: EntryLinkSource | undefined;
}

/** An Entry link as it came, with the key of the Widget Snapshot the widget's link carries. */
export interface ParsedEntryLink extends EntryLink {
  readonly key: string | undefined;
}

/** The path of an Entry's link, `/entry/<id>`. */
const entryPath = /^\/entry\/([^/]+)$/;

/** The link to an Entry, opened as from `source`. */
export function linkTo(entryId: string, source: EntryLinkSource): string {
  return `/entry/${encodeURIComponent(entryId)}?from=${source}`;
}

/** Where the search params of an Entry link say it opened from, or nothing for a link from inside the app. */
export function linkSourceOf({
  from,
}: {
  readonly from?: string | undefined;
}): EntryLinkSource | undefined {
  return SOURCES.find((source) => source === from);
}

/** The Entry link of a path and search, or nothing for a path other than `/entry/<id>`. */
export function parseLink(link: string): ParsedEntryLink | undefined {
  const [path = '', search = ''] = link.split('?');
  const encoded = entryPath.exec(path)?.[1];
  if (encoded === undefined) return undefined;
  let entryId: string;
  try {
    entryId = decodeURIComponent(encoded);
  } catch {
    return undefined;
  }
  return {
    entryId,
    source: linkSourceOf({ from: searchParam(search, 'from') }),
    key: searchParam(search, 'key'),
  };
}

/** The first value of a search param, decoded as a web address decodes it, or nothing without one. */
function searchParam(search: string, name: string): string | undefined {
  for (const pair of search.split('&')) {
    const [key = '', ...value] = pair.split('=');
    if (key !== name) continue;
    const raw = value.join('=').replace(/\+/g, ' ');
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return undefined;
}

/**
 * An Entry link that came from outside the app, as the app opens it. Only
 * the widget's link keeps its source, and only with the key of the Widget
 * Snapshot the widget reads now, which an app or a web page can't read; any
 * other is a plain link, so its Entry is not Seen and goes into no History. A
 * notification's link never comes from outside: the app opens it inside.
 */
export function linkFromOutside(
  link: ParsedEntryLink,
  widgetLinkKey: string | undefined,
): EntryLink {
  const fromWidget =
    link.source === 'widget' && widgetLinkKey !== undefined && link.key === widgetLinkKey;
  return { entryId: link.entryId, source: fromWidget ? 'widget' : undefined };
}
