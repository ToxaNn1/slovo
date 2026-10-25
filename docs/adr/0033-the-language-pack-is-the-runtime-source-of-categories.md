# The Language Pack is the runtime source of Categories

Over-the-air content updates (0.7) replace the Language Pack and keep the JavaScript bundle. A Category read from `edition.json`, which Metro bundles, would miss one that an update adds: it would have no name, and its Entries would never become Eligible, even for a reader whose Mix follows a default of every Category (ADR 0019).

The Language Pack is the only place the app reads Categories from: the Categories of Words and, a list of their own, the Categories of Corrections (ADR 0050). The pack build writes each list into its own table (`categories` and `correction_categories`) in the order the Edition declares it, and the content checksum (ADR 0011) covers both. The Core's content read port lists each, with display names, in the pack's order, also a Category whose Entries are all Retired (`listCategories` and `listCorrectionCategories`). One contract suite holds the in-memory adapter and the pack reader to it, as for the Entries (ADR 0015).

- The Entries read the pack's Categories once per app session, as the pack never changes while it is open, and give them to the Mix and to the card builders.
- A default Mix of `'all'` means every Category of the pack. A new Category has no user-state record, so by ADR 0019 it follows the default: it joins the Mix of every reader whose Edition defaults to `'all'`, also a reader who took other Categories out. A default that lists Categories leaves a new one out, as a Hidden Category. The Mix state carries all the pack's Categories, which the Mix screen and the Hidden screen draw.
- A Word card carries its Category's display name. The Feed, the Entry screen, the hide choice and the Share Card take the name from the card.
- The Core's `Edition` keeps only what can't change without a store build, such as the default Mix and the Feature Switches. It has no Categories, and the UI's `EditionProvider` names none.

`edition.json` lists both kinds of Category (`categories` and `correctionCategories`) as the content source the pack build writes into the pack and checks the Entries against; the build refuses an Entry whose Category is not in its list. It also names the Categories of Words whose Words must carry their Word History (`categoriesRequiringHistory`, an empty list when none does), every one of them in `categories`; the build refuses a Word in such a Category without it. The pack carries each Word's history, not the list, so the rule binds the content and never the app. The app reads them at build time only. Loading the Edition checks that a default Mix that lists Categories lists only ones the file has; the default Mix changes only with a store build anyway.

## Considered Options

- **Keep the Categories in the bundle and have the update add new ones**: rejected. Two sources of one list would drift, and a new Category would still need a store build to get its name.
- **Move the Categories out of `edition.json` into `content/`**: rejected for now. Nothing at runtime reads them from the bundle either way, and the move would only change where the build finds them. Revisit when the Edition folder's build inputs are regrouped.
- **Read the Categories on every question about eligibility**: rejected. The pack never changes while it is open, so one read per module is enough, as for the live Entries (ADR 0015).
