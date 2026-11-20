# Test states

In a development build, one link replaces the stored user state of the active Edition with a named test state and reloads the app, so a drawn state of `docs/design/export/SLOVO All Screens.dc.html` is reached in seconds (#1551). A production build holds neither the link nor the states (`apps/mobile/src/user-state/test-state-bundle.test.ts`).

Open a link on the simulator with `xcrun simctl openurl booted '<link>'`. The scheme is the AppConfig's `scheme` (`app/app.json`); below it is `slovo`. A link with an unknown name, or `slovo://dev/state` alone, opens the Feed and logs the names on offer.

Each state is built from the declared user-state records of the Core (`changesOfFacts`), with dates from the device's Clock, and the Entry ids, Badges and Levels of the open Language Pack and Edition. The schema version and the installed marker stay; everything else, pending Sync changes included, is replaced. Code: `apps/mobile/src/user-state/test-states.ts`.

| Name                   | Link                                     | State                                                                                          |
| ---------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `fresh`                | `slovo://dev/state/fresh`                | Nothing kept: the onboarding from its first step.                                              |
| `day-3-streak`         | `slovo://dev/state/day-3-streak`         | A Streak of 3, today included.                                                                 |
| `streak-lost`          | `slovo://dev/state/streak-lost`          | A 10-day run that ended 11 days ago: Streak 0, Best Streak 10.                                 |
| `streak-frozen`        | `slovo://dev/state/streak-frozen`        | Five Active Days up to the day before yesterday, yesterday covered by a Streak freeze.         |
| `level-up`             | `slovo://dev/state/level-up`             | Level 1, one XP short of Level 2: the next right Game answer reaches it.                       |
| `level-7`              | `slovo://dev/state/level-7`              | Level 7.                                                                                       |
| `all-badges`           | `slovo://dev/state/all-badges`           | Every Badge of the Edition earned, «Рік без пропусків» included.                               |
| `no-badges`            | `slovo://dev/state/no-badges`            | Two Active Days, under Level 1, no Badge.                                                      |
| `reviews-due`          | `slovo://dev/state/reviews-due`          | Five Words marked Unknown two days ago, due for Review since yesterday.                        |
| `cycle-end`            | `slovo://dev/state/cycle-end`            | Every Entry Seen in the Cycle but the first Word: one more Entry, then the end of a Cycle.     |
| `weekly-recap`         | `slovo://dev/state/weekly-recap`         | Last week's reading: 7 Active Days, 7 Seen, 3 Favorites, 4 Known, yesterday's Word of the Day. |
| `empty-saved`          | `slovo://dev/state/empty-saved`          | Past the onboarding, nothing saved.                                                            |
| `full-saved`           | `slovo://dev/state/full-saved`           | 12 Favorites, 6 in Learning, 30 in History, 4 Collections of 5 Entries.                        |
| `crossword-solved`     | `slovo://dev/state/crossword-solved`     | Today's Daily Crossword solved.                                                                |
| `crossword-7-in-a-row` | `slovo://dev/state/crossword-7-in-a-row` | Daily Crosswords solved the last 7 days in a row, today included.                              |

## Shifting the day

`?day=` on a test state link moves the device clock's local day before the state is built, keeping the time of day, so a day-bound screen (the Weekly Recap on a Monday) shows on any day (#1859):

- `?day=<weekday>`, such as `slovo://dev/state/weekly-recap?day=monday`: the next such weekday, today included.
- `?day=<YYYY-MM-DD>`, such as `slovo://dev/state/fresh?day=2026-12-31`: that date, past or future.

Every test state link without `?day=` takes the shift back to the system day; a day that is neither form logs a warning and shifts nothing. The bare `slovo://dev/state?day=monday` shifts the day and loads no state. While shifted, a warning says Sync may write shifted times: shifted records reach the Account when signed in. The shift lives in memory and is set again from the link the app reopens with after the reload; a cold start without the link runs on the system day. A production build ignores the parameter: its device clock tells the system time (`apps/mobile/src/user-state/test-state-bundle.test.ts`). Code: `dayShiftOf` in `apps/mobile/src/user-state/test-states.ts`, `shiftDeviceClock` in `apps/mobile/src/device/device-clock.ts`.

Limits:

- `weekly-recap`: the Weekly Recap shows on a local Monday only; on another day the state holds last week but no Recap shows, unless the link adds `?day=monday`.
- `crossword-solved`, `crossword-7-in-a-row`: the solves are XP log records only, so the crossing Daily Crossword's card reads solved while its grid opens empty.
