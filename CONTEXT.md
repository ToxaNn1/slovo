# SLOVO

SLOVO helps people discover, learn and share rare words of a single language. It is built as a factory: one shared **Core** produces many single-language **Editions**.

## Language

### Factory

**Edition**:
A standalone app dedicated to exactly one language; its UI language, content language and store listing are all that language. The first Edition is Ukrainian.
_Avoid_: Flavor, variant, localization

**Language Pack**:
Everything that makes an Edition specific to its language: words, categories, UI strings and language traits (e.g. whether the language marks stress).
_Avoid_: Locale bundle, dictionary

**Content update**:
A newer Language Pack of the Edition that the app downloads by itself, without an Account, and opens from the next launch.
_Avoid_: OTA (that is an update of the app's JavaScript), patch

**Core**:
The language-agnostic behaviour and screens shared by every Edition. Editions never replace Core code.
_Avoid_: Engine, base app

**Feature Switch**:
A per-Edition on/off setting for a Core feature (e.g. the Game), set in the Edition or remotely. A remote switch can only turn a feature off; only the Edition turns one on. Its effective value, which everything reads, is the Edition's value and not off remotely.
_Avoid_: Toggle, flag (in conversation)

**Extension Point**:
A place the Core deliberately opens for an Edition to plug in its own behaviour or UI, such as extra Game modes, extra Word card sections or language services.
_Avoid_: Hook, override, plugin

**Decor**:
Purely visual elements an Edition supplies for slots the Core defines, such as backgrounds or an embroidery-style ornament divider. Decor never carries behaviour.
_Avoid_: Skin, theme (a Theme is the user's light/dark choice)

### Entries

**Entry**:
Anything the user can discover, keep and share: a Word, a Correction or an Idiom. Favorites, Collections, History, Seen and the Feed all work with Entries.
_Avoid_: Item, card, content

**Word**:
A single dictionary entry shown to the user, identified by an id that stays stable across Language Pack updates. Homonyms (коса the hair, коса the tool) are separate Words; shades of one meaning are several Definitions of one Word.
_Avoid_: Card, entry, term

**Retired Word**:
A Word withdrawn from the Language Pack. It never appears in the Feed, notifications, widgets or the Game, but stays visible wherever the user already keeps it (Favorites, Collections, History).
_Avoid_: Deleted word

**Lemma**:
The dictionary form of a Word as it is written.
_Avoid_: Title, headword

**Stress**:
The stressed vowel position(s) of a Lemma; a Lemma may have more than one valid Stress. Only exists in Editions whose language marks stress. A wrong-stress Correction's forms carry Stress too, written into their text as the combining acute mark after the stressed vowel (ADR 0045).
_Avoid_: Accent

**Definition**:
The explanation of one meaning of a Word or an Idiom, written in the Edition's language. A Word or an Idiom has one primary Definition and may have more.
_Avoid_: Description, meaning, explanation

**Example**:
A sentence showing a Word or an Idiom in use.
_Avoid_: Usage, sample

**Synonym**:
A word with a close meaning, shown to help understanding.

**Region**:
Where a dialect Word is said (e.g. Гуцульщина), a short text in the Edition's language. Only a Word with the dialectal register label («діал.») carries one, and the Language Pack build refuses it on any other Word. The Entry card, its Self-check state once revealed and the Share Card show it after that label, «діал., Гуцульщина», and VoiceOver reads it there.
_Avoid_: Area, dialect, location

**Category**:
A thematic group a Word or a Correction belongs to. Words and Corrections each have the Edition's own list: Words by what they name (e.g. human body, emotions, military), Corrections by where a reader meets them (e.g. at work, in a shop, transport). Every Word and every Correction has one Category of its list.
_Avoid_: Topic, tag, theme

**Rare Word**:
The editorial standard for every Word: a normative dictionary word that an educated native speaker most likely doesn't know or hardly uses, but is worth knowing. It excludes obscene words, surzhyk and russianisms, narrow jargon and proper names; an old, witty dictionary insult marked «лайл.» or «зневажл.» (e.g. бевзь, телепень) is a Rare Word, an obscene word never is. A place name is not a Word: it is an Idiom of Idiom Type `placeName`. A dialect Word, with the dialectal register label («діал.») and its Region, is a Rare Word too when a normative dictionary (e.g. СУМ, Грінченко) or a dialect dictionary that names the Region lists it. Each Word carries a rarity from 1 ("heard it, never use it") to 5 ("almost nobody knows it").

**Correction**:
A non-standard form people commonly use (often a phrase) paired with one or more standard equivalents in the Edition's language, plus a short neutral explanation, e.g. «на протязі року» → «протягом року». A Core concept; each Edition supplies its own Corrections. A Word may point to the Corrections it is the standard form for (протягом → «на протязі»), so each is reachable from the other without duplicating data.
_Avoid_: Mistake, error, surzhyk card

**Retired Correction**:
A Correction withdrawn from the Language Pack. Like a Retired Word, it never appears anywhere new and is no longer linked from Words, but stays visible wherever the user already keeps it.
_Avoid_: Deleted correction

**Correction Type**:
Why the form is non-standard: russianism, calque, surzhyk, officialese (канцелярит), anglicism (англіцизм), an English borrowing where a dictionary word of the Edition's language serves, or wrong stress (`wrongStress`, «наголос»: a stress trap, the right word said with the wrong Stress).

**Idiom**:
A fixed expression whose meaning is not the sum of its words, with its Definitions, Examples and, where known, its origin, e.g. «бити байдики» → «ледарювати». The third kind of Entry (ADR 0046); a Core concept, each Edition supplies its own. An Idiom has an expression instead of a Lemma, and no Stress, part of speech, Category, rarity or Pronunciation. Its Ukrainian name is «фразеологізм».
_Avoid_: Phrase, expression (for the Entry; the expression is its text), saying, proverb

**Idiom Type**:
What kind of fixed expression an Idiom is: `idiom` («фразеологізм»), an idiom proper, or `placeName` («топонім»), a place name whose etymology tells the story of its name and is required. A place name shares the Idiom's card, Feed turn, Mix switch and lists; only its chip differs.
_Avoid_: Subtype, kind (a kind is Word, Correction or Idiom)

**Retired Idiom**:
An Idiom withdrawn from the Language Pack. Like a Retired Word, it never appears anywhere new, but stays visible wherever the user already keeps it.
_Avoid_: Deleted idiom

**Entry card**:
How the app shows one Entry: a Word card, a Correction card or an Idiom card in the same frame, with the action row (heart, Collections, share, hide) under it. The Feed and every screen that opens a kept Entry show the same Entry card.
_Avoid_: Item, tile (for a card; a tile is the motif Decor slot 1 repeats)

### User's words

**Favorites**:
The single built-in list of Entries the user marked with the heart ("save word").
_Avoid_: Saved words, likes

**Collection**:
A list of Entries the user created and named; an Entry may be in many Collections.
_Avoid_: Folder, playlist, list

**Saved**:
Only the name of the tab that groups Favorites, Collections and History. Not a concept of its own.

**History**:
The most recent Seen Entries, newest first, without duplicates (a re-seen Entry moves to the top), capped at 500. Survives Cycles.
_Avoid_: Recent, log

### Progress

**Active Day**:
A local calendar day on which the user opened the app.

**Streak**:
The number of consecutive Active Days up to today; missing a day resets it. Always derived from Active Days, never stored on its own.
_Avoid_: Chain, run

**Best Streak**:
The most consecutive Active Days the user has ever had, derived from them like the Streak and never stored; a reset of the Streak leaves it.
_Avoid_: Top streak, longest chain

**Account**:
The optional identity ("SLOVO ID") that keeps a user's words and progress across devices. One Account works in every Edition, and the user sees it as «SLOVO ID» in each of them; each Edition's data stays separate. An email has one Account, which every Sign-in method reaches: a Sign-in code or Sign in with Google. Without an Account everything lives on the device only.
_Avoid_: Cabinet, profile, login

**Session**:
One device's sign-in to an Account, ended on that device or on all at once.
_Avoid_: Token, login

**Sync**:
The background exchange of the reader's words and progress between a device and their Account. It needs an Account and waits for the network when offline.
_Avoid_: Backup, replication, cloud save

**Sign-in code**:
The one-time six-digit code from the email that signs the reader in. The first right code for an email creates its Account.
_Avoid_: OTP, PIN, password

**Sign-in method**:
A way a reader proves an email to sign in: a Sign-in code, or Sign in with Google, whose identity token the backend verifies. Whatever the method, the email's one Account signs in, and the first sign-in of an email creates it (ADR 0047). The Edition's Feature Switch `googleSignIn` turns the Google method on.
_Avoid_: Provider, login type, auth method

### Discovery

**Feed**:
The vertical stream of Entries the user swipes through on the home screen; Corrections and Idioms are mixed in among Words. Every 5th card of the Cycle is a Correction's turn while the Cycle has unseen Corrections, and every 7th card an Idiom's turn while it has unseen Idioms, each counted from its kind's last card; when both turns fall on one card the Correction takes it and the Idiom the next. While Entries are due for Review, every 3rd card that is neither turn is a Word due for Review, labelled «Повторення», and a Correction due for Review takes the next Correction's turn before a new Correction, as an Idiom due for Review takes the next Idiom's turn before a new Idiom, Seen in this Cycle or not. The Word of the Day and the Review slot stay Words only.
_Avoid_: Timeline, home list

**Seen**:
An Entry is Seen in the current Cycle once its card stayed on screen for a minimum dwell time in the Feed, or the user opened it from a notification or widget.
_Avoid_: Viewed, read

**Cycle**:
One pass through all eligible Entries. When every Entry is Seen, the user is told to wait for new Words, and the next swipe starts a new Cycle in which nothing is Seen yet.
_Avoid_: Round (that is a Game term), loop

**Knowledge Mark**:
What the reader says about an Entry on its card: Known («Знаю») or Unknown («Не знаю»). Tapping the other mark changes it, tapping the same one again removes it. On a Correction, Known means "I already say it right". A mistake in the Game is an Unknown mark; there is no separate list of hard words.
_Avoid_: Rating, grade

**Review**:
An Entry coming back to the Feed after 1, 3 or 7 local days. Unknown starts it at 1 day; Known on a Review moves it from 1 to 3 days, then to 7 days; Unknown at any step starts again at 1 day. A Review overrides Seen: a due Entry comes back even if it is Seen in the current Cycle. Answers in the Game never move a Review.
_Avoid_: Repeat, flashcard, spaced repetition

**Due**:
An Entry is due for Review on or after its Review day, and stays due until the reader marks it. A Hidden Entry or an Entry that is not eligible is skipped until it is eligible again.

**Learned**:
An Entry that is Known on its 7-day Review, or Known with no earlier mark. It stops coming back for Review, stays in the Cycle and is counted as known in the statistics.

**Self-check**:
A setting («Перевір себе», off by default) that hides the answer on an Entry card until the reader taps: a Word card shows only the Lemma with Stress, part of speech and Category, a Correction card only the non-standard form, an Idiom card only the expression and the chip of its Idiom Type. The Knowledge Mark buttons work only after the reveal. It applies to the Feed, the Word of the Day included, and not to the widget or Share Cards.
_Avoid_: Quiz mode, test mode

**Mix**:
The set of Categories, plus Corrections as a whole and Idioms as a whole, that the user chose to see in the Feed, notifications, widgets and the Game. At least one Category always stays in the Mix. The Mix also holds the Rarity Floor.
_Avoid_: Filter, preferences

**Rarity Floor**:
The lowest rarity of Words the reader wants, «від 1» to «від 5», default «від 1». Only Words of that rarity or rarer are eligible, in the Feed and the Game, so a high floor leaves only the rarest Words. Corrections and Idioms have no rarity and are not affected. Part of the Mix.
_Avoid_: Difficulty, level

**Hidden Entry**:
An Entry the user disliked; it never appears in the Feed, notifications, widgets or the Game again unless unhidden.
_Avoid_: Disliked, blocked, muted, hidden word

**Hidden Category**:
A Category, of Words or of Corrections, the user took out of their Mix, whether from the Mix itself, from a card's hide action or on the Hidden screen. Hiding a Category and taking it out of the Mix are one and the same; its Words or Corrections are excluded from everything new the same way as a Hidden Entry.
_Avoid_: Muted topic

**Eligible Entry**:
An Entry that may appear anywhere new (the Feed, notifications, widgets, the Game): not Retired, of a kind the Edition turns on (and not off remotely), in the user's Mix (a Word of a Category in the Mix at the Rarity Floor or rarer; a Correction or an Idiom while its kind is in) and not Hidden. An Entry that is not eligible stays visible wherever the user already keeps it.
_Avoid_: Available, visible, active entry

**Reserved**:
A Word already promised to a scheduled notification, so no other notification picks it. Reserved is not Seen.

**Notification time**:
One of the user's local times of day at which a notification comes, such as 09:00. A new user has the Edition's default times; the user may keep up to 10, no two equal, always in time order. With none left, notifications are off. Notification times stay on the device.
_Avoid_: Reminder, alarm, schedule

**Word of the Day**:
One unseen Word fixed for the user's local calendar day; it opens the Feed and is the morning notification.
_Avoid_: Daily word

**Pronunciation**:
The Word read aloud by the device's voice for the Edition's language.
_Avoid_: Audio, TTS

**Share Card**:
A branded image of an Entry made for sharing outside the app.
_Avoid_: Screenshot

**Widget Mode**:
What a home-screen widget shows, chosen per widget: Улюблене (the Favorites), one Collection, or Усі слова (every Eligible Entry). Every mode shows only Eligible Entries.
_Avoid_: Game Mode, filter

**Widget Snapshot**:
Everything each Widget Mode may show, decided by the Core and ready to draw, which the app writes into the App Group for the widget to read. The widget reads nothing else.
_Avoid_: Widget cache, widget database

### Game

**Game**:
A run of up to 15 Rounds in one Game Mode, with 5 Lives. Up to 5 of the 15 Rounds are drawn from eligible Entries that are Unknown or due for Review, the rest as before; a wrong answer marks the Entry Unknown. At its end the Game shows its Game Review.
_Avoid_: Quiz, practice, test

**Game Mode**:
The kind of challenge in a Game. The Core mode is Definition → pick the Word, and asks about idioms of Idiom Type `idiom` the same way, with four idioms; place names never play. The Correction mode is a sentence with a non-standard form → pick the standard equivalent. Editions may add modes through an Extension Point.

**Round**:
One prompt with four options, exactly one correct.
_Avoid_: Level, question

**Life**:
One allowed mistake; a wrong answer costs a Life, losing all Lives ends the Game.
_Avoid_: Heart, attempt

**Distractor**:
A wrong option in a Round.

**Best result**:
The most Rounds passed in one finished Game, in any Game Mode; one per Edition. Stored, since finished Games are not kept, and written only when a finished Game beats it; a Game left before its end never counts.
_Avoid_: High score, top score

**Game Review**:
The result screen's list of every played Round in order, ✓ or ✗, with the reader's pick on a wrong answer. A tap expands the Definition, Example and etymology (a Correction: the right form and the explanation); a second tap opens the Entry. Its answers are kept only until the result screen and are not stored.
_Avoid_: Mistakes list, answer log
