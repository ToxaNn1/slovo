# Each Edition publishes its legal pages

The App Store asks every app for a privacy policy at a public address, and an app with Accounts owes its readers terms of use. Each Edition speaks its own language to its own readers, so its legal pages are its own text, like its strings (spec #603, #630). Until 0.8.9 SLOVO had neither the pages nor a place to publish them.

**An Edition's legal pages live in its folder, `editions/<id>/legal/`, one Markdown file per page:** `privacy.md` and `terms.md`, in the Edition's language, each with a front matter naming its title and language. They are Edition content, like the Entries and the strings, so a new Edition writes its own and no Core or UI code holds legal text.

**GitHub Pages publishes them.** The workflow `pages.yml` runs on every push to `main` that touches `editions/*/legal/**`, its own site files in `.github/pages/` or itself. It gathers each Edition's pages under `/<id>/` (so `editions/uk/legal/privacy.md` is served at `/uk/privacy`), builds them with Jekyll and the one layout of `.github/pages/`, and deploys the site. A change to a page is live once it merges, with no app build.

**The Edition config names the addresses.** `legalPages` in `edition.json` holds the web addresses of `privacy` and `terms`, both required and checked as web addresses by the contracts (`LegalPagesSchema`); the Core's Edition carries them, and About opens them in the browser. The config names addresses rather than files: the app bundles no page, it only opens one.

**`edition-folder.ts` doesn't name `legal/`.** ADR 0035 makes it the only code that knows where an Edition's files lie, and no code reads the legal pages: the app opens their addresses, and only the Pages workflow touches the files, with a shell loop over `editions/*/legal` that runs before any dependency is installed. Naming the folder in the module would give it an entry no caller reads, and running the module in the workflow would install the workspace to copy two files. The workflow's loop is the one place outside the module that knows a part of an Edition folder's layout; the first Node code that reads the legal pages, such as a check that every Edition has both, reads them through `edition-folder.ts`, and the module names `legal/` then.

## Considered Options

- **The pages inside the app**: rejected. The App Store wants a public address it and readers can open without the app, and a change would wait for a build.
- **A separate website repository**: rejected. The pages belong with the Edition they describe, change in the same pull requests as the features they describe, and a second repository is one more thing to keep in step.
- **File names in the config instead of addresses**: rejected. The app has no use for a file it doesn't bundle; it needs the address to open.
