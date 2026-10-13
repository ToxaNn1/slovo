# One Core composition opens the Feed and the user's words together

From 0.3 the Feed, Favorites, Collections, History, Hidden Entries and the Mix depend on each other. Hiding an Entry or changing the Mix changes which Entries are eligible, so the Cycle reads them again and the Feed drops the cards that are no longer eligible. An Entry that becomes Seen joins History in the same write. A heart tapped in the Feed changes the counts on the Saved tab.

The Core opens all of them in one composition once the Language Pack is open, over one Entries module, one Cycle and the stored user state, and makes every one of these links inside it. Each feature tells its subscribers when it changes, as the Feed does (ADR 0016), so a shell subscribes to what it draws and holds no rule between features. Tests drive the composition, not the features one by one.

The settings that style the Language Pack's own loading and error screens (Theme, font size, and from 0.3 Vibration) still open before the pack and stay apart from the composition, as ADR 0016 found.

## Considered Options

- **Separate Core modules that the shell connects**, such as a call to the Feed after each hide: rejected. The links decide what the reader may see next, yet they would live in untested React code, the problem ADR 0016 removed from the Feed.
- **A stream of user-state changes that each module subscribes to**: rejected. The links become implicit, the order of writes is hard to reason about, and tests would still assemble several modules to see one behaviour.
- **Settings inside the composition**: rejected. The Theme is needed before the Language Pack opens, to draw the pack's loading and error screens.
