# One app per platform with the Editions inside, and the UA Edition

ADR 0002 made every language its own App Store app, an Edition built from the shared Core, and named the risk itself: App Store Review Guideline 4.3(a) ("Don't create multiple Bundle IDs of the same app") starts to bite with the second Edition. Its fallback was a single SLOVO app that loads Editions as language packs. The 1.0 strategy review of 31.10 (Q81–Q88) takes that fallback as the plan before the second Edition exists, so no Edition is ever rejected under 4.3 and the owner keeps one listing, one review queue and one subscription.

**One app per platform; the Editions are languages inside it.** There is one iOS app and one Android app. An Edition is still configuration, content and assets for exactly one language, its UI language and content language the same, built on the shared, language-agnostic Core (ADR 0006); what changes is that Editions are no longer separate apps. The Core stays a reusable product rather than code inside one Edition, for the same reason ADR 0002 gave: every Edition runs on it.

**The app keeps the first Edition's identity.** The bundle id stays `app.slovo.uk`, so every reader of 0.x updates in place. The app's name is the Ukrainian brand name and SLOVO is the developer. The primary store locale is Ukrainian, and each market gets its own localized store page (name, screenshots, keywords, ratings per country), which is where an Edition becomes a brand of its own. The user state already on a phone opens as the `uk` Edition's store.

**One Edition is active at a time.** The app chooses the active Edition at launch from its Edition registry (`apps/mobile/src/edition/registry.ts`, the Editions it bundles): the one an app-level store, apart from every Edition's user state, keeps from an earlier launch; else the Edition of the device's first preferred language that has one (an Edition id is its language code); else the bundled default, the UA Edition. The choice is kept, so a reader stays in their Edition when the device language changes. Until a second Edition exists the app asks nothing; with downloads, the first onboarding screen asks the reader to choose when no Edition has the device language. Settings switch the active Edition, and a switch restarts the app, so every module keeps reading one Edition fixed at launch and the shell still opens one Shell per run (ADR 0036). Each Edition keeps its own progress: History, Streak, XP, badges and Review are per Edition. Notifications, the widget, Spotlight and App Intents come only from the active Edition.

**The device-language Edition ships in the app; the others download on choice.** The bundled Edition is `defaultEdition` in the AppConfig (`app/app.json`), today the UA Edition: every build of the app bundles it, from one build profile per platform, and no build, Update or CI run names an Edition. After its download an Edition works fully offline, like the bundled one. Each Edition's configuration ships with its content; how is decided when the download is built.

**Feature Switches stay per Edition.** An Edition still turns Core features on and off for itself, and a remote switch still only turns one off (ADR 0040).

**One subscription for every language,** priced per country through the store's price tiers; the details belong to the pricing decision, not here.

**One domain for the app, named after SLOVO, with a path per Edition** (`/<edition>/`), for the legal pages, Collection Links and the backend. A market's own domain may come later, only as a redirect. Until the name is chosen the code keeps `slovo.example`.

**The first Edition is the UA Edition; its id stays `uk`.** «UA» is the brand label people see and say, after the market. The id is the language code: ISO 639-1 has `uk` for Ukrainian, while `ua` is the country, and `Intl.PluralRules`, sorting and the `uk-UA` locale need the language. The id also names the Edition folder, the backend's data partition (ADR 0030), the Update channel (ADR 0062) and the user-state store, so renaming it would move live data for a label. Docs and code comments say «UA Edition».

**1.0 ships with one Edition, the UA Edition, already in the one-app structure.** Downloading and switching Editions are built before the second Edition.

## Consequences

- ADR 0002 is superseded. The 4.3 mitigation list (a name, Decor, content and listing per Edition) is no longer a rule: Decor, content and the store page stay per Edition because they are the Edition, not to pass review.
- The factory rule that a language needs features of its own to become an Edition goes; a language needs a store page localization for its market. Two or more unique features remain a wish.
- ADRs written for one app per Edition give way to this one where they conflict and are rewritten with the tickets that do the work. Done for the link domain, the legal pages, Collection Links and the backend's domain: ADR 0006 (no `linkDomain`), 0049 (legal pages on the app's domain), 0058 (Collection Links at `/<edition>/c/<id>`) and 0063 (the backend behind the app's domain). The rest of the Edition's own bundle id and Apple ids stays for the tickets that do it.
- The widget, Spotlight and App Intents show only the active Edition: the Widget Snapshot carries the Edition id and the widget, built with the Edition id, reads only that Edition's (ADR 0026); Spotlight items and App Intents name the Edition in their routes as `edition=<id>` (ADR 0057). A link of a native surface naming another Edition opens the app's start. The native parts (strings, fonts, palette) are baked for the bundled Edition at prebuild.

## Considered Options

- **Keep one app per language (ADR 0002)**: rejected. Each new Edition risks a 4.3 rejection, and a rejection lands after the Edition is built; each would also need its own listing, review, subscription and ratings from zero.
- **Switch Editions live, without a restart**: rejected for now. The Edition is read once at module load across the app and the shell opens one Shell per run; a restart keeps that design, and a reader switches language rarely.
- **Rename the id to `ua` with the label**: rejected. The id is a language code wherever the platform reads it, and it keys live data on phones and on the server.
- **Bundle every Edition in the app**: rejected. A reader needs one language; the rest would be download size for nothing.
