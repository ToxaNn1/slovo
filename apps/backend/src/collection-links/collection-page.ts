import { renderStress, type CollectionLink, type Entry, type EntryKind } from '@slovo/contracts';
import type { Edition } from '@slovo/server-core';
import { html } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';

/** The order the page lists the kinds of Entries in, the Feed's (CONTEXT.md). */
const KINDS: readonly EntryKind[] = ['word', 'correction', 'idiom', 'synonymRow', 'tip'];

/** What the page shows of an Entry: its headword, with Stress where it has one, and one line under it. */
function shownOf(entry: Entry): { readonly title: string; readonly line: string } {
  switch (entry.kind) {
    case 'word':
      return { title: renderStress(entry), line: entry.primaryDefinition };
    case 'correction':
      return { title: entry.standardEquivalents.join(', '), line: entry.explanation };
    case 'idiom':
      return { title: entry.expression, line: entry.primaryDefinition };
    case 'synonymRow': {
      const { text, stress } = entry.dominant;
      return { title: renderStress({ lemma: text, stress }), line: entry.meaning };
    }
    case 'tip':
      return { title: entry.title, line: entry.explanation };
  }
}

/** A page of the Edition, in its language: plain HTML, no script. */
function page(
  edition: Edition,
  title: string,
  body: HtmlEscapedString | Promise<HtmlEscapedString>,
) {
  return html`<!doctype html>
    <html lang="${edition.config.locale}">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${title}</title>
        <style>
          body {
            font-family: Georgia, serif;
            max-width: 40rem;
            margin: 0 auto;
            padding: 1rem;
            line-height: 1.5;
          }
          dt {
            font-weight: bold;
            margin-top: 0.75rem;
          }
          dd {
            margin: 0;
          }
        </style>
      </head>
      <body>
        ${body}
      </body>
    </html>`;
}

/**
 * The web page of a Collection Link (ADR 0058): the Collection's name, the
 * Entries of the link the Edition's pack has, by kind in the link's order,
 * the line that it is a snapshot, the link that opens it in the app and the
 * TestFlight line. It shows what the link stores and nothing more.
 */
export function collectionPage(
  edition: Edition,
  id: string,
  link: CollectionLink,
  entries: readonly Entry[],
) {
  const strings = edition.strings.collections.link;
  const inLinkOrder = [...entries].sort(
    (a, b) => link.entryIds.indexOf(a.id) - link.entryIds.indexOf(b.id),
  );
  const sections = KINDS.map((kind) => {
    const ofKind = inLinkOrder.filter((entry) => entry.kind === kind).map(shownOf);
    if (ofKind.length === 0) return '';
    return html`<h2>${strings.page.kinds[kind]}</h2>
      <dl>
        ${ofKind.map(
          ({ title, line }) =>
            html`<dt>${title}</dt>
              <dd>${line}</dd> `,
        )}
      </dl> `;
  });
  // The app's link scheme, as its config names it: `slovo-<edition id>`.
  const appLink = `slovo-${edition.config.id}://c/${id}`;
  return page(
    edition,
    strings.page.title.replace('{name}', () => link.name),
    html`<h1>${link.name}</h1>
      <p>${strings.page.snapshot}</p>
      ${sections}
      <p><a href="${appLink}">${strings.page.open}</a></p>
      <p>${strings.page.testFlight}</p>`,
  );
}

/** The page of a link that isn't available: unknown, malformed, or of an Edition that doesn't serve it. */
export function unavailablePage(edition: Edition) {
  const { notFound } = edition.strings.collections.link;
  return page(edition, notFound, html`<p>${notFound}</p>`);
}
