# The Language Pack is the runtime source of Categories

Until now the app read its Categories from `edition.json`, which Metro bundles into the JavaScript. The pack build already wrote a `categories` table, and the content checksum (ADR 0011) covers it, but nothing read that table. Over-the-air content updates (0.7) replace the Language Pack and keep the bundle, so a Category new in an update would have no name and its Words would never become Eligible, even for a reader whose Mix follows a default of every Category (ADR 0019).

The Language Pack is now the only place the app reads Categories from. The Core's content read port lists every Category of the pack, with its display name, in the pack's order (the order the Edition declares them in), also one whose Words are all Retired. One contract suite holds the in-memory adapter and the pack reader to it, as for the Entries (ADR 0015).

- The Entries read the pack's Categories once per app session, as the pack never changes while it is open, and give them to the Mix and to the card builders.
- A default Mix of `'all'` means every Category of the pack. A new Category has no user-state record, so by ADR 0019 it follows the default: it joins the Mix of every reader whose Edition defaults to `'all'`, also a reader who took other Categories out. A default that lists Categories leaves a new one out, as a Hidden Category. The Mix state carries all the pack's Categories, which the Mix screen and the Hidden screen draw.
- A Word card carries its Category's display name. The Feed, the Entry screen, the hide choice and the Share Card take the name from the card.
- The Core's `Edition` keeps only what can't change without a store build, such as the default Mix and the Feature Switches. It has no Categories, and the UI's `EditionProvider` no longer names them.

`edition.json` still lists the Categories, as the content source the pack build writes into the pack and checks the Words against. Loading the Edition still checks that a default Mix that lists Categories lists only ones the file has; the default Mix changes only with a store build anyway. This amends ADR 0009's "the runtime Edition config the Core loads": the Categories in it are read at build time only.

## Considered Options

- **Keep the Categories in the bundle and have the update add new ones**: rejected. Two sources of one list would drift, and a new Category would still need a store build to get its name.
- **Move the Categories out of `edition.json` into `content/`**: rejected for now. Nothing at runtime reads them from the bundle either way, and the move would only change where the build finds them. Revisit when the Edition folder's build inputs are regrouped.
- **Read the Categories on every question about eligibility**: rejected. The pack never changes while it is open, so one read per module is enough, as for the live Entries (ADR 0015).
