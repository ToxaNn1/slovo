# One Core composition opens the Feed and the user's words together

From 0.3 the Feed, Favorites, Collections, History, Hidden Entries and the Mix depend on each other. Hiding an Entry or changing the Mix changes which Entries are eligible, so the Cycle reads them again and the Feed drops the cards that are no longer eligible. An Entry that becomes Seen joins History in the same write. A heart tapped in the Feed changes the counts on the Saved tab.

The Core opens all of them in one composition once the Language Pack is open, over one Entries module, one Cycle and the stored user state, and makes every one of these links inside it. Each feature tells its subscribers when it changes, as the Feed does (ADR 0016), so a shell subscribes to what it draws and holds no rule between features. Tests drive the composition, not the features one by one.

The settings that style the Language Pack's own loading and error screens (Theme, font size, and from 0.3 Vibration) still open before the pack and stay apart from the composition, as ADR 0016 found.

## Considered Options

- **Separate Core modules that the shell connects**, such as a call to the Feed after each hide: rejected. The links decide what the reader may see next, yet they would live in untested React code, the problem ADR 0016 removed from the Feed.
- **A stream of user-state changes that each module subscribes to**: rejected. The links become implicit, the order of writes is hard to reason about, and tests would still assemble several modules to see one behaviour.
- **Settings inside the composition**: rejected. The Theme is needed before the Language Pack opens, to draw the pack's loading and error screens.

## Amendment: a composition a reopen replaced closes (whole-project review, M1)

From 0.8 the shell reopens the composition over the same user state (ADR 0036, amendment for #381), and until now the old one never closed. What still held it kept writing: the Feed effect's cleanup told the old Feed that its card left the screen, so it wrote Seen, History and the reader's place after the new composition had read them, and a Reserved Word Seen this way made the old Notifications hand the device their plan after the new one's. An old `resume` started on the return to the foreground could do the same, and an undo toast kept the old Hiding.

A composition now has `close()`. From then on it writes nothing to the user state, hands the device no plan, and the Game tries no planning of its offers again; its modules stay readable, and their changes stay in memory only. It closes at the ports it was given, the user state's `write`, the scheduler's `replacePlan` and the `schedule` of the Game's tries, so no module needs a rule of its own and a module added later is closed too. `close()` resolves once the writes and the plans it had under way end, and never rejects.

The shell's opening takes a `close` with the value a reopen replaced, and calls it once it has told its subscribers of the new value. The composition's opening closes the old composition there. Every screen then draws over the new composition, and the cleanups React runs after that find the old one closed, so the Feed of the new composition, which opens on the reader's card, makes it Seen when it leaves the screen.

An undo toast may outlive the composition it came from: a reopen can come in its seconds. So «Скасувати» undoes in the composition open at the tap, not through the undo the old one returned: a hide's undo is an unhide of what it changed, and a restore's undo hides the Entry again at the time it was hidden, which an unhide of an Entry now returns (`hiddenAt`). The reader's undo so works as always, and the composition open now knows of it.

A write or a plan the old composition started before it closed still ends as it would; the reopens come after a sync or a remote switch check, both of which wait on the network, so the old composition's own work has ended by then.

### Considered Options

- **Close the old composition before the new one opens**: rejected. The reader keeps using the old one while the new one opens, and every heart, hide or mark tapped meanwhile would be lost.
- **A `closed` check in each module (the Feed's `show`, the plan, the Hiding's undo)**: rejected. Each module would carry the same rule, and a write path missed or added later would stay open.
- **An undo after a reopen does nothing, or the reopen takes the toast away**: rejected by the owner. The reader would tap «Скасувати» and see the Entry stay Hidden, or see the toast go before its time.
