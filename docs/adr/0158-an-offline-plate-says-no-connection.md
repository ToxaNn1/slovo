# An offline plate says there is no connection

Before this, each action that needs the network said «no connection» its own way: sharing a Collection Link in a toast at the bottom, signing in in a red line under the field, Sync in the line «Синхронізація чекає на мережу». The board XSettings (m6) draws one look for all of them.

**One plate, «Немає з’єднання. Спробуй пізніше.».** It drops in from above under the status bar, the Theme's ink plate (the cream in the dark Theme) with its left edge leaning in at the bottom, a no-signal mark crossed in red, and hides after 3.2 s. VoiceOver reads it as an alert; under Reduce Motion it stands in place at once.

**Where it shows.** Only where an action needs the network and finds none: sharing a Collection Link, every request of the Account (signing in, signing out everywhere, deleting) and a sync while the Account screen is open. With the plate on, those toasts and the offline line under the Account's field are gone, and the Sync line gives the last sync instead of «чекає на мережу». The Feed never shows it: the Feed works offline. A screen whose content itself could not be fetched, such as a Collection Link's preview, keeps its own state.

**How.** `OfflinePlateProvider` of `@slovo/ui` wraps every screen in the root layout and `useOfflinePlate()` shows it; the app's `useOfflineNotice()` gives it only while the Feature Switch `offlinePlate` is on in effect. The text is the Edition's string `offlinePlate`.

**Feature Switch.** `offlinePlate`; off, each action says it as before.

## Considered Options

- **A toast at the bottom, as before**: rejected. The board draws the plate at the top, and a toast below collides with the tab bar and the sheets.
- **A plate for any network state, shown whenever the device goes offline**: rejected. The Feed, the Games and the Saved screens work offline; telling the reader so would only alarm.
