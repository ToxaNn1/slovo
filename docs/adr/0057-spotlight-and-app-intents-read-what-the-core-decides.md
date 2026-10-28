# Spotlight and App Intents read what the Core decides

Until 0.8.15 the phone around SLOVO knew nothing of it: typing «сумир» in the iPhone search found nothing, though «сумирний» was in the reader's Favorites, and Siri and Shortcuts couldn't open the Word of the Day or the Game. Spec #937 puts SLOVO into the iPhone's search and into Siri and Shortcuts. Both need native code, and native code is where rules about Entries would hide from the Core's tests. As with the widget (ADR 0026), the Core decides what the phone shows and where a tap or a phrase lands; native code only writes and opens. The decisions come from the owner's grilling of 2026-10-25 and 2026-10-26.

**Feature Switches.** `spotlight` and `appIntents` are required of every Edition and on in the Ukrainian Edition. Like every Feature Switch, a remote switch can only turn them off (ADR 0040).

**The Spotlight Snapshot.** The Core builds a Spotlight Snapshot as pure data, beside the Widget Snapshot and from the same sources:

- **One item per Entry** found in Favorites, any Collection or the Word of the Day archive (ADR 0054), each Entry once however many of them hold it, with the headline, second line and VoiceOver text the Core decides for its kind, as in the Widget Snapshot (ADR 0026), and the Entry's route. Any kind of Entry the Edition turns on may be one.
- **One item per Collection**, empty ones too: its name, «Колекція · {n} слів» in the Edition's plural forms (ADR 0020), and the Collection's route. The reader finds a Collection by its name.
- **Left out**: Hidden Entries and Retired Entries, so the search never shows what the app won't, though a Retired Entry stays where the reader keeps it in the app. An Entry that leaves its last list, unfavorited, removed from its last Collection, leaves the snapshot. The Word of the Day archive keeps a Retired Word (ADR 0054), but the snapshot does not.
- **Switch off**: with `spotlight` off the snapshot is empty.

The snapshot covers nothing else: Entries outside Favorites, Collections and the archive are never indexed.

**Native code only writes it.** A local Swift module in the app (an Expo module under `apps/mobile`, not a published package) takes the snapshot and writes it into CoreSpotlight, replacing the whole previous index of the app, so an item gone from the snapshot is gone from the search and an empty snapshot empties the index. It holds no rule about Entries, plurals or lists. The shell hands the snapshot over when the app goes to the background and whenever Favorites, Collections or the archive change, Sync's changes included, so the index is never far behind. A dev client without the module writes nothing.

**A tap reaches the app through the existing routes.** Each item's route is the one the app already has: an Entry's `entry/<id>` and a Collection's `saved/collections/<id>`. The module turns a tap on a search result into that link, and it enters the app like every link from outside, through `app/+native-intent.tsx` (ADR 0026), so it opens as a plain link: not Seen and in no History. There is no new route and no new way in.

**App Intents only open the app.** Two App Intents, each with an App Shortcut, so they are in Siri and the Shortcuts app with no setup:

- **«Слово дня»**, said as «Слово дня в SLOVO» or «Покажи слово дня в SLOVO», opens the app on the Word of the Day card, the Feed's first card.
- **«Відкрити гру»**, said as «Відкрий гру в SLOVO» or «Грати в SLOVO», opens the Game.

Neither reads the user state nor the Language Pack, speaks a Word or shows a snippet: each opens the app on a route, and the Core picks today's Word of the Day on arrival as on any launch, so a reader who hasn't opened the app today never gets yesterday's word. With `appIntents` off both open the app's start. The intents' titles and phrases are the Edition's strings, written into the app at prebuild like the widget's (ADR 0026), so Swift holds no Edition text.

**Testing.** The Spotlight Snapshot is tested in the Core with a fake Language Pack and fake user state; the landings of both intents and the routes in the app shell; the module and App Shortcuts wired in through the app config. The Swift code has no automated tests: writing into CoreSpotlight, a tap on a result, Siri's phrases and the Shortcuts actions are owner checks on the EAS build of 0.9 (ADR 0004).

## Considered Options

- **Swift reads Favorites, Collections and the archive itself**: rejected. Swift would copy the Core's rules for Hidden, Retired and kinds, and the user state would move into the App Group, as ADR 0026 rejected for the widget.
- **Index every Eligible Entry**: rejected. The phone's search would fill with words the reader never met; the reader looks for what they kept.
- **Update the index item by item**: rejected. Replacing it with the whole snapshot never leaves a removed Entry behind, and a few hundred items are cheap to write.
- **New routes for search results and intents**: rejected. The existing Entry, Collection and Game routes already open from outside through one gate.
- **Intents that answer in Siri without opening the app**: rejected. Siri would need the Word of the Day decided natively, or a stale one written ahead; out of scope for 0.8.15.
- **Intents that pick the Word of the Day**: rejected. The Core already picks it on every launch; a second picker could disagree.
