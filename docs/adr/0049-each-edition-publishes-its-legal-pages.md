# Each Edition publishes its legal pages

The App Store asks every app for a privacy policy at a public address, and an app with Accounts owes its readers terms of use. Each Edition speaks its own language to its own readers, so its legal pages are its own text, like its strings (spec #603, #630). Until 0.8.9 SLOVO had neither the pages nor a place to publish them.

**An Edition's legal pages live in its folder, `editions/<id>/legal/`, one Markdown file per page:** `privacy.md` and `terms.md`, in the Edition's language, each with a front matter naming its title and language. They are Edition content, like the Entries and the strings, so a new Edition writes its own and no Core or UI code holds legal text.

**GitHub Pages publishes them.** The workflow `pages.yml` runs on every push to `main` that touches `editions/*/legal/**`, its own site files in `.github/pages/` or itself. It gathers each Edition's pages under `/<id>/` (so `editions/uk/legal/privacy.md` is served at `/uk/privacy`), builds them with Jekyll and the one layout of `.github/pages/`, and deploys the site. A change to a page is live once it merges, with no app build.

**The Core derives the addresses from one base and the Edition id.** The site's base address, today `https://toxann1.github.io/slovo`, is named once, as the Core constant `LEGAL_SITE` beside `loadEdition`, and `loadEdition` derives each Edition's `legalPages` as `<LEGAL_SITE>/<id>/privacy` and `<LEGAL_SITE>/<id>/terms`, the same addresses the workflow serves. The Core's Edition carries them, and About opens them in the browser. `edition.json` names no legal page address: the addresses are a function of the site and the id, so writing them by hand made two sources of truth (the workflow and each config) that nobody kept in step, and a new site address, such as a custom domain, changes the one constant and nothing per Edition. The config also names no files: the app bundles no page, it only opens one.

**`edition-folder.ts` doesn't name `legal/`.** ADR 0035 makes it the only code that knows where an Edition's files lie, and no code reads the legal pages: the app opens their addresses, and only the Pages workflow touches the files, with a shell loop over `editions/*/legal` that runs before any dependency is installed. Naming the folder in the module would give it an entry no caller reads, and running the module in the workflow would install the workspace to copy two files. The workflow's loop is the one place outside the module that knows a part of an Edition folder's layout; the first Node code that reads the legal pages, such as a check that every Edition has both, reads them through `edition-folder.ts`, and the module names `legal/` then.

## Considered Options

- **The pages inside the app**: rejected. The App Store wants a public address it and readers can open without the app, and a change would wait for a build.
- **A separate website repository**: rejected. The pages belong with the Edition they describe, change in the same pull requests as the features they describe, and a second repository is one more thing to keep in step.
- **File names in the config instead of addresses**: rejected. The app has no use for a file it doesn't bundle; it needs the address to open.
- **The full addresses in the config** (the decision until 0.9): dropped. They repeated by hand what the site and the Edition id derive, so a changed site meant editing every Edition and a typo was caught by nobody.
- **A base address per Edition in the config**, such as `legalSite`: rejected. Every Edition of the factory publishes on the one site the workflow deploys, so a field per Edition would repeat one value and still change in every config when the site moves.
