# Test states

In a development build, one link replaces the stored user state of the active Edition with a named test state and reloads the app, so a drawn state of `docs/design/export/SLOVO All Screens.dc.html` is reached in seconds (#1551). A production build holds neither the link nor the states (`apps/mobile/src/user-state/test-state-bundle.test.ts`).

Open a link on the simulator with `xcrun simctl openurl booted '<link>'`. The scheme is the AppConfig's `scheme` (`app/app.json`); below it is `slovo`. A link with an unknown name, or `slovo://dev/state` alone, opens the Feed and logs the names on offer.

Each state is built from the declared user-state records of the Core (`changesOfFacts`), with dates from the device's Clock, and the Entry ids, Badges and Levels of the open Language Pack and Edition. The schema version and the installed marker stay; everything else, pending Sync changes included, is replaced. Code: `apps/mobile/src/user-state/test-states.ts`.

| Name                   | Link                                     | State                                                                                     |
| ---------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------- |
| `fresh`                | `slovo://dev/state/fresh`                | Nothing kept: the onboarding from its first step.                                         |
| `day-3-streak`         | `slovo://dev/state/day-3-streak`         | A Streak of 3, today included.                                                            |
| `streak-lost`          | `slovo://dev/state/streak-lost`          | A 10-day run that ended 11 days ago: Streak 0, Best Streak 10.                            |
| `streak-frozen`        | `slovo://dev/state/streak-frozen`        | Five Active Days up to the day before yesterday, yesterday covered by a Streak freeze.    |
| `level-up`             | `slovo://dev/state/level-up`             | Level 1, one XP short of Level 2: the next right Game answer reaches it.                  |
| `level-7`              | `slovo://dev/state/level-7`              | Level 7.                                                                                  |
| `all-badges`           | `slovo://dev/state/all-badges`           | Every Badge of the Edition earned, «Рік без пропусків» included.                          |
| `no-badges`            | `slovo://dev/state/no-badges`            | Two Active Days, under Level 1, no Badge.                                                 |
| `reviews-due`          | `slovo://dev/state/reviews-due`          | Five Words marked Unknown two days ago, due for Review since yesterday.                   |
| `cycle-end`            | `slovo://dev/state/cycle-end`            | Every Entry Seen in the Cycle but the first Word: one more card, then the end of a Cycle. |
| `weekly-recap`         | `slovo://dev/state/weekly-recap`         | Last week's reading: 7 Active Days, 7 Seen, 3 Favorites, 4 Known.                         |
| `empty-saved`          | `slovo://dev/state/empty-saved`          | Past the onboarding, nothing saved.                                                       |
| `full-saved`           | `slovo://dev/state/full-saved`           | 12 Favorites, 6 in Learning, 30 in History, 4 Collections of 5 Entries.                   |
| `crossword-solved`     | `slovo://dev/state/crossword-solved`     | Today's Daily Crossword solved.                                                           |
| `crossword-7-in-a-row` | `slovo://dev/state/crossword-7-in-a-row` | Daily Crosswords solved the last 7 days in a row, today included.                         |

Limits:

- `weekly-recap`: the Weekly Recap shows on a local Monday only (ADR 0054); on another day the state holds last week but no Recap shows.
- `crossword-solved`, `crossword-7-in-a-row`: the solves are XP log records only, so the crossing Daily Crossword's card (ADR 0087) reads solved while its grid opens empty; the traced Daily Crossword (ADR 0073) starts with no Word found.
