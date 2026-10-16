# Source folders group modules by glossary domain

Until 0.6 `packages/core/src`, `packages/ui/src` and `apps/mobile/src` each kept every module in one flat folder. The files of one feature were scattered alphabetically, so nothing showed what belongs together or which layer is which.

The modules of these three packages are grouped into folders named after the domains of `CONTEXT.md`, and the files inside a folder stay flat. Each package moves in its own change, the Core first, and the UI and the app follow. The set of folders is the same in each package, so everything about Collections lies in `saved/` in the Core, the UI and the app. The Core's folders are `edition/`, `user-state/`, `entries/`, `hidden/`, `saved/`, `feed/`, `notifications/`, `game/` and `fakes/`, the test doubles of its ports that `index.ts` exports. The UI and the app take the same names where they have the domain, plus their own layers: the UI's `providers/`, `decor/` and `primitives/` sit below its domain folders and import none of them.

The rules:

- A folder appears when a domain has at least two modules. A single module, such as the Core's `onboarding.ts` or `widget.ts`, stays at the root of `src/`.
- The top and the shared base stay at the root: the Core's `composition.ts` (ADR 0018), which opens every module, and `ports.ts`, `in-turn.ts` and `local-date.ts`, which nearly every module imports; each package's `index.ts`; and the UI's `tokens.ts`. A test of the whole composition, such as `opened-from-widget.test.ts`, stays beside `composition.ts`.
- A module goes where its domain's rule lives, not where its name points: `mix` sits in `entries/`, since the Entries module decides which Entries are Eligible (ADR 0015) and imports it, `correction-mode` sits in `game/`, since it is a Game Mode built on the Game, and `haptics` too, since only the Game's haptic sequence uses it (ADR 0025).
- Files move with `git mv` and keep their names, so the history follows them and a move changes only import paths. A test stays beside its module.
- A folder has no `index.ts` barrel. Each package keeps one public `index.ts`, and the other parts of the workspace import through the package entry points only (dependency-cruiser's `workspace-parts-import-through-the-entry-point`).
- Domain folders import each other in one direction. `no-circular` already rejects a cycle between files; a cycle between folders means a module sits in the wrong one.

Not regrouped: `apps/mobile/src/app/` holds the Expo Router routes, whose paths are the app's links. `packages/language-pack` is one build pipeline, `packages/contracts` already has its `edition-strings/`, and `tools/sourcing` is small. Edition content, `docs/` and the Maestro flows are data and documents, whose numbering or ids give their order. An older ADR keeps the path it was written with, such as ADR 0013's `packages/core/src/user-state-schema.ts`, now in `user-state/`.

## Considered Options

- **One folder per component** (`Button/Button.tsx` beside its styles and test): rejected. Styles live in a `StyleSheet.create` in the component's own file (`docs/react-native.md`), and UI components have no unit tests, so each folder would hold one file, often with its own `index.ts`. The flat list would only move one level down.
- **Folders by layer** (`models/`, `services/`, `hooks/`): rejected. A feature would still be spread over every folder, and the layers of the Core are its modules and the composition on top, not kinds of file.
- **One flat folder, as before**: rejected. With 77 files in the Core and dozens more in the UI and the app, the alphabet decides what sits together.
