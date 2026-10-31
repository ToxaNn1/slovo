# SLOVO

SLOVO helps people discover, learn and share rare words of a single language. It is built as a factory: one shared **Core** produces many single-language **Editions**.

## Language

### Factory

**Edition**:
One language inside the one SLOVO app (ADR 0065): its configuration, content and assets, with its UI language and content language the same, its own progress and its own localized store page. One Edition is active at a time. The first Edition is the UA Edition, Ukrainian, whose id is the language code `uk`.
_Avoid_: Flavor, variant, localization, separate app, Ukrainian Edition, UK Edition

**Language Pack**:
Everything that makes an Edition specific to its language: words, categories, UI strings and language traits (e.g. whether the language marks stress).
_Avoid_: Locale bundle, dictionary

**Content update**:
A newer Language Pack of the Edition that the app downloads by itself, without an Account, and opens from the next launch.
_Avoid_: OTA (that is an update of the app's JavaScript), patch

**Update channel**:
An Edition's stream of signed OTA updates to the app's JavaScript, named after the Edition id and bound to its builds; an update reaches only the builds whose native code it was made for, and the owner publishes one deliberately, to a share of readers first (ADR 0062).
_Avoid_: Release, release channel, branch

**Deployment**:
The one running backend that serves every Edition: one container image on Railway with its Postgres, behind the Edition's domain (ADR 0063). Its secrets and addresses live in its environment variables, never in the repository.
_Avoid_: Env, prod, server (the backend is the code; the Deployment is its running copy)

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
Purely visual elements an Edition supplies for slots the Core defines, such as backgrounds or an embroidery-style ornament divider. Decor never carries behaviour. While «Сезонний декор» is on, slot 1 (the background) and slot 2 (the divider centre) show the motif of the local date's Holiday, or else of its Season; the other slots never change with the date.
_Avoid_: Skin, theme (a Theme is the user's light/dark choice)

**Season**:
The meteorological season of the reader's local date: December–February winter, March–May spring, June–August summer, September–November autumn. The Edition supplies a Decor motif for each; it changes at local midnight.
_Avoid_: Time of year, theme

**Holiday**:
A date the Edition lists by a rule, a fixed day and month (24 August) or the nth weekday of a month (День вишиванки, the third Thursday of May), with its own Decor motif. On a Holiday its motif shows instead of the Season's.
_Avoid_: Event, celebration, special day

### Entries

**Entry**:
Anything the user can discover, keep and share: a Word, a Correction, an Idiom, a Synonym Row or a Tip. Favorites, Collections, History, Seen and the Feed all work with Entries.
_Avoid_: Item, card, content

**Word**:
A single dictionary entry shown to the user, identified by an id that stays stable across Language Pack updates. Homonyms (коса the hair, коса the tool) are separate Words; shades of one meaning are several Definitions of one Word.
_Avoid_: Card, entry, term

**Word History**:
How a Word left the language or changed its meaning, a text in the Edition's language that the Word may carry (the field `history`). An Edition may require it of the Words of some Categories. It is neither where the Word comes from, its etymology, nor the user's History of Seen Entries.
_Avoid_: Etymology, history on its own

**Illustration**:
A PNG picture a Word may carry above its Definition, named by its field `illustration` and bundled in the app as an Edition asset, not in the Language Pack. It is square, at most 150 KB, shown at most 160 pt high and the same in both Themes. Only Words carry Illustrations.
_Avoid_: Image, picture, Decor (Decor belongs to slots, not to Words)

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
A non-standard form people commonly use (often a phrase) paired with one or more standard equivalents in the Edition's language, plus a short neutral explanation, e.g. «на протязі року» → «протягом року». A Core concept; each Edition supplies its own Corrections. A Word may point to the Corrections it is the standard form for (протягом → «на протязі»), so each is reachable from the other without duplicating data. A rule with no one form to swap is a Tip, not a Correction.
_Avoid_: Mistake, error, surzhyk card

**Literary Use**:
A real use of a Correction's standard form in literature, quoted with its author and work and shown under the Correction («Як пишуть насправді»). Only texts in the public domain (ADR 0045); a Correction carries up to three.
_Avoid_: Quote, citation (a citation is a source)

**Retired Correction**:
A Correction withdrawn from the Language Pack. Like a Retired Word, it never appears anywhere new and is no longer linked from Words, but stays visible wherever the user already keeps it.
_Avoid_: Deleted correction

**Correction Type**:
Why the form is non-standard: russianism, calque, surzhyk, officialese (канцелярит), anglicism (англіцизм), an English borrowing where a dictionary word of the Edition's language serves, wrong stress (`wrongStress`, «наголос»: a stress trap, the right word said with the wrong Stress), or a paronym (`paronym`, «пароніми»: a word swapped for its look-alike of another meaning, e.g. «ефективна сукня» → «ефектна сукня»).

**Idiom**:
A fixed expression whose meaning is not the sum of its words, with its Definitions, Examples and, where known, its origin, e.g. «бити байдики» → «ледарювати». The third kind of Entry (ADR 0046); a Core concept, each Edition supplies its own. An Idiom has an expression instead of a Lemma, and no Stress, part of speech, Category, rarity or Pronunciation. Its Ukrainian name is «фразеологізм».
_Avoid_: Phrase, expression (for the Entry; the expression is its text); saying or proverb for the Entry (a proverb is an Idiom of Idiom Type `proverb`)

**Idiom Type**:
What kind of fixed expression an Idiom is: `idiom` («фразеологізм»), an idiom proper; `placeName` («топонім»), a place name whose etymology tells the story of its name and is required; or `proverb` («прислів’я»), a proverb or saying. A place name and a proverb share the Idiom's card, Feed turn, Mix switch and lists; only the chip differs.
_Avoid_: Subtype, kind (a kind is Word, Correction, Idiom, Synonym Row or Tip)

**Retired Idiom**:
An Idiom withdrawn from the Language Pack. Like a Retired Word, it never appears anywhere new, but stays visible wherever the user already keeps it.
_Avoid_: Deleted idiom

**Synonym Row**:
A dominant word with a short meaning line and a row of 5 to 12 of its synonyms, its members, each with its Stress and an optional note on its shade, e.g. «іти → простувати, чимчикувати, шкандибати». The fourth kind of Entry (ADR 0051); a Core concept, each Edition supplies its own. A member or the dominant may link a Word of the Language Pack, and that Word's card links back to the row («У синонімічному ряду: іти»). A Synonym Row has no Category, rarity or Pronunciation; a Retired one behaves like a Retired Word. Its Ukrainian name is «синонімічний ряд». Its members are not the Synonyms a Word lists.
_Avoid_: Synonym set, thesaurus

**Tip**:
A rule of good speech with its standard form, a short explanation and its own Game question, e.g. «Котра година?» instead of «Скільки час?». The fifth kind of Entry (ADR 0051); a Core concept, each Edition supplies its own. It may show a non-standard form, but needs none (the vocative «пане Андрію» has no wrong form to show). The boundary with a Correction: one form swapped for one standard form is a Correction; a rule, a construction, etiquette or punctuation is a Tip. A Tip has no Category, rarity or Pronunciation; a Retired one behaves like a Retired Word. Its Ukrainian name is «порада».
_Avoid_: Hack, advice, lifehack

**Entry card**:
How the app shows one Entry: a Word card, a Correction card, an Idiom card, a Synonym Row card or a Tip card in the same frame, with the action row (heart, Collections, share, hide, and the flag of «Повідомити про помилку») under it. The Feed and every screen that opens a kept Entry show the same Entry card.
_Avoid_: Item, tile (for a card; a tile is the motif Decor slot 1 repeats)

### User's words

**Favorites**:
The single built-in list of Entries the user marked with the heart ("save word").
_Avoid_: Saved words, likes

**Collection**:
A list of Entries the user created and named; an Entry may be in many Collections. A Collection can be shared by a Collection Link, and «Додати собі» on a Collection Link copies it as the reader's own Collection, which syncs like any other.
_Avoid_: Folder, playlist, list

**Collection Link**:
An immutable, never-expiring snapshot of a Collection on the server (its name and its Entry ids in order) behind `https://<linkDomain>/c/<id>`, made by «Поділитися посиланням». Later edits to the Collection never reach it; sharing again makes a new link. Neither side needs an Account.
_Avoid_: Share link, invite

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
The optional identity ("SLOVO ID") that keeps a user's words and progress across devices. One Account works in every Edition, and the user sees it as «SLOVO ID» in each of them; each Edition's data stays separate. An email has one Account, which every Sign-in method reaches: a Sign-in code, Sign in with Google or Sign in with Apple. Without an Account everything lives on the device only.
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
A way a reader proves an email to sign in: a Sign-in code, or Sign in with Google or Sign in with Apple, whose identity token the backend verifies. Whatever the method, the email's one Account signs in, and the first sign-in of an email creates it (ADR 0047). The Edition's Feature Switches `googleSignIn` and `signInWithApple` turn the Google and the Apple method on.
_Avoid_: Provider, login type, auth method

### Discovery

**Feed**:
The vertical stream of Entries the user swipes through on the home screen; Corrections, Idioms, Synonym Rows and Tips are mixed in among Words. Every 5th card of the Cycle is a Correction's turn while the Cycle has unseen Corrections, every 7th an Idiom's turn while it has unseen Idioms, every 9th a Synonym Row's turn while it has unseen Synonym Rows and every 11th a Tip's turn while it has unseen Tips, each counted from its kind's last card. When turns fall on one card the order is Correction, Idiom, Synonym Row, Tip, and each loser takes the next card. While Entries are due for Review, every 3rd card that is no other kind's turn is a Word due for Review, labelled «Повторення», and a Correction, an Idiom, a Synonym Row or a Tip due for Review takes the next turn of its kind before a new one, Seen in this Cycle or not. The Word of the Day and the Review slot stay Words only. Beside Entry cards the Feed shows Feed Notices, which take no turn.
_Avoid_: Timeline, home list

**Feed Notice**:
A Feed card that is not an Entry: the Weekly Recap, the Community Word, a first-week card, «Пам'ятаєте вчорашнє слово?» (yesterday's Word of the Day in Self-check style) or the Daily Limit card. From the second card on, the day's Feed Notices take a card each, in the order Weekly Recap, Community Word, first-week card, yesterday's Word; the Daily Limit card comes once the limit is reached. A Feed Notice counts in no turn and no Review slot and makes nothing Seen; swiping past it closes it for the local day.
_Avoid_: Banner, tip (a Tip is an Entry)

**Seen**:
An Entry is Seen in the current Cycle once its card stayed on screen for a minimum dwell time in the Feed, or the user opened it from a notification or widget. Opening an Entry from Search or the mood roulette, the Rarity Test and Feed Notices make nothing Seen.
_Avoid_: Viewed, read

**Cycle**:
One pass through all eligible Entries. When every Entry is Seen, the user is told to wait for new Words, and the next swipe starts a new Cycle in which nothing is Seen yet.
_Avoid_: Round (that is a Game term), loop

**Knowledge Mark**:
What the reader says about an Entry on its card: Known («Знаю») or Unknown («Не знаю»). Tapping the other mark changes it, tapping the same one again removes it. A mark set from 0.8.13 on keeps the time it was set; only marks with a time count in a Weekly Recap. On a Correction, Known means "I already say it right". A mistake in any Game Mode is an Unknown mark; there is no separate list of hard words.
_Avoid_: Rating, grade

**Review**:
An Entry coming back to the Feed after 1, 3 or 7 local days. Unknown starts it at 1 day; Known on a Review moves it from 1 to 3 days, then to 7 days; Unknown at any step starts again at 1 day. A Review overrides Seen: a due Entry comes back even if it is Seen in the current Cycle. Answers in the Game never move a Review.
_Avoid_: Repeat, flashcard, spaced repetition

**Due**:
An Entry is due for Review on or after its Review day, and stays due until the reader marks it. A Hidden Entry or an Entry that is not eligible is skipped until it is eligible again.

**Learned**:
An Entry that is Known on its 7-day Review, or Known with no earlier mark. It stops coming back for Review, stays in the Cycle and is counted as known in the statistics.

**Self-check**:
A setting («Перевір себе», off by default) that hides the answer on an Entry card until the reader taps: a Word card shows only the Lemma with Stress, part of speech and Category, a Correction card only the non-standard form, an Idiom card only the expression and the chip of its Idiom Type, a Synonym Row card only its dominant («іти → ?»), a Tip card only its title and its non-standard form (only the title when it has none). The Knowledge Mark buttons work only after the reveal. It applies to the Feed, the Word of the Day included, and not to the widget or Share Cards.
_Avoid_: Quiz mode, test mode

**Mix**:
The set of Categories of Words, plus Corrections as a whole with their own Categories under it, plus Idioms, Synonym Rows and Tips each as a whole, that the user chose to see in the Feed, notifications, widgets and the Game. At least one Category of each list always stays in the Mix. The Mix also holds the Rarity Floor.
_Avoid_: Filter, preferences

**Rarity Floor**:
The lowest rarity of Words the reader wants, «від 1» to «від 5», default «від 1». Only Words of that rarity or rarer are eligible, in the Feed and the Game, so a high floor leaves only the rarest Words. Entries of other kinds have no rarity and are not affected. Set in the Mix or by the Rarity Test. Part of the Mix.
_Avoid_: Difficulty, level

**Hidden Entry**:
An Entry the user disliked; it never appears in the Feed, notifications, widgets or the Game again unless unhidden. Any kind of Entry can be hidden from its card, and the Hidden screen lists Hidden Entries by kind, Synonym Rows («Синонімічні ряди») and Tips («Поради») included, while the Edition turns the kind on.
_Avoid_: Disliked, blocked, muted, hidden word

**Hidden Category**:
A Category, of Words or of Corrections, the user took out of their Mix, whether from the Mix itself, from a card's hide action or on the Hidden screen. Hiding a Category and taking it out of the Mix are one and the same; its Words or Corrections are excluded from everything new the same way as a Hidden Entry.
_Avoid_: Muted topic

**Eligible Entry**:
An Entry that may appear anywhere new (the Feed, notifications, widgets, the Game): not Retired, of a kind the Edition turns on (and not off remotely), in the user's Mix (a Word of a Category in the Mix at the Rarity Floor or rarer; a Correction while Corrections and its Category are in; an Idiom while Idioms are in; a Synonym Row while Synonym Rows are in; a Tip while Tips are in) and not Hidden. An Entry that is not eligible stays visible wherever the user already keeps it.
_Avoid_: Available, visible, active entry

**Search**:
«Пошук»: finding Entries by their visible text, behind a magnifier in the «Головна» header. It covers every Entry of a kind the Edition turns on that is neither Retired nor Hidden, the Mix and the Rarity Floor aside, and ignores case, Stress, the kind of apostrophe, г/ґ and е/ё. A text matches from 2 characters when it or one of its words starts with the query; «За значенням», from 3 characters, finds Words by their Definition and the Synonym Rows that contain the query. Opening a result makes nothing Seen. The last 10 queries stay on the device.
_Avoid_: Lookup, filter, dictionary

**Rarity Test**:
«Перевірка рівня»: 10 Words, 2 of each rarity, each shown as its Lemma with Stress for «Знаю» or «Не знаю», which set the Rarity Floor to the lowest rarity with «Не знаю» («від 5» if all are known). Optional in onboarding after the Mix and again from Settings. It sets no Knowledge Mark, starts no Review and makes nothing Seen.
_Avoid_: Level test, placement test, quiz

**Weekly Recap**:
«Ваш тиждень»: a Feed Notice on the first open of a local Monday about the Monday–Sunday week before it: the Entries Seen, the Favorites added, the Known marks set in that week (left out with the Knowledge Marks off) and the current Streak, with a Share Card. No Weekly Recap follows a week without an Active Day.
_Avoid_: Weekly report, digest, summary

**Community Word**:
«Слово тижня спільноти»: a Feed Notice on a local Monday right after the Weekly Recap, showing the Entry readers most added to Favorites in the last ISO week (the lower id on a tie) as a mini Entry card with «додали {n} читачів». There is none when nobody added anything or the Entry is Hidden or Retired for the reader. A tap opens the Entry.
_Avoid_: Word of the week, top word, trending word, Word of the Day

**Community Counters**:
Anonymous counts of how many readers know an Entry, don't know it and saved it, shown under its mark buttons as «Знають {known} з {total} читачів · зберегли {saved}», and of its Favorites adds per ISO week, which choose the Community Word. A device sends only the changes it made itself after the update, with no Account and no device id, never Game answers, and nothing while «Ділитися анонімною статистикою» is off; the server keeps totals, never one reader's marks.
_Avoid_: Analytics, stats, statistics (the reader's own numbers), ratings

**Mistake Report**:
«Повідомлення про помилку»: what a reader sends from an Entry card's menu about a mistake in that Entry: its type (typo, Stress, Definition or other), an optional comment of at most 500 characters (required for other), the Edition, the Entry id, the app version and the content version. It carries no Account and no device id, waits on the device until it can be sent, and is kept on the server until the owner resolves it.
_Avoid_: Bug report, feedback, complaint

**Daily Limit**:
«Ліміт на день»: a setting, off by default, of 10, 20 or 30 distinct Entries Seen on a local day, the Word of the Day included. At the limit the Feed shows the Feed Notice «На сьогодні досить. Повертайтеся завтра»; «Гортати далі» removes it until tomorrow. The limit never locks the Feed.
_Avoid_: Cap, quota, screen time

**Mood**:
«настрій»: one of the moods an Edition lists (id, name, emoji) that a Word may carry. «Слово під настрій» opens a mood's roulette, which lands on a random Eligible Word of that mood and opens its card without making it Seen.
_Avoid_: Emotion, feeling, vibe

**Reserved**:
A Word already promised to a scheduled notification, so no other notification picks it. Reserved is not Seen.

**Notification time**:
One of the user's local times of day at which a notification comes, such as 09:00. A new user has the Edition's default times; the user may keep up to 10, no two equal, always in time order. With none left, notifications are off. Notification times stay on the device. Notifications come at most 14 days after the user last opened the app: the last one of the 14th day is a farewell with no Word, and nothing comes after it until the next open.
_Avoid_: Reminder, alarm, schedule

**Word of the Day**:
One unseen Word fixed for the user's local calendar day; it opens the Feed and is the morning notification. Each day its card was Seen joins the reader's archive «Слова дня» in Saved, synced, newest first; a Retired Word stays there.
_Avoid_: Daily word

**Pronunciation**:
The Word read aloud by the device's voice for the Edition's language.
_Avoid_: Audio, TTS

**Share Card**:
A branded image of an Entry, or of the reader's Weekly Recap («Мій тиждень у SLOVO»), made for sharing outside the app.
_Avoid_: Screenshot

**Widget Mode**:
What a home-screen widget shows, chosen per widget: Улюблене (the Favorites), one Collection, or Усі слова (every Eligible Entry). Every mode shows only Eligible Entries.
_Avoid_: Game Mode, filter

**Widget Snapshot**:
Everything each Widget Mode may show, decided by the Core and ready to draw, which the app writes into the App Group for the widget to read. It also says whether today's Word of the Day was Seen (`wordOfTheDaySeenOn`). The widget reads nothing else.
_Avoid_: Widget cache, widget database

**Spotlight Snapshot**:
What the iPhone search may find, decided by the Core: each Entry in Favorites, any Collection or the Word of the Day archive once, and each Collection as «Колекція · {n} слів», Hidden and Retired Entries left out. A local Swift module writes it into CoreSpotlight, replacing the whole index; with `spotlight` off it is empty.
_Avoid_: Search index cache

### Game

**Game**:
A run of Rounds in one Game Mode: up to 15 Rounds with 5 Lives by default. A Game Mode may set its own Lives, Round limit and time limit: «Виживання» has 3 Lives and no Round limit, «На час» 60 seconds and no Lives. In every Game Mode up to 5 Rounds are drawn from eligible Entries that are Unknown or due for Review, the rest as before; a wrong answer marks the Entry Unknown. At its end the Game shows its Game Review. The Daily Crossword is not a Game.
_Avoid_: Quiz, practice, test

**Game Mode**:
The kind of challenge in a Game. A Game Mode sets its Lives (or none), its Round limit (or none), its time limit (or none) and the form of its answers, and has its own Feature Switch. The Core modes, in four groups:

- «Слова»: «Вгадай слово» (`guess-word`), a Definition → pick the Word, getting harder as it goes (Rounds 6–10 an Example with a gap, Rounds 11–15 a Definition → type the Word); it asks about idioms of Idiom Type `idiom` the same way, with four idioms (place names never play), about Synonym Rows with «Що є синонімом до „{домінанта}“?», one member of the row right and members of other rows wrong (only while the Mix holds at least 4 Synonym Rows), and about Tips, each with its own Game question; «Наголос» (`stress`), tap the stressed vowel; «Пари» (`pairs`), match 4 Words to 4 Definitions; «Анаграми» (`anagram`), assemble the Word from shuffled letters; «За буквами» (`by-letters`), type the Word, opening letters if needed; «Впиши слово» (`type-word`), a sentence with a non-standard form → type the standard form; «Звідки слово» (`origin`), pick the language a Word came from.
- «Виправлення»: «Обери правильне» (`correction`), a sentence with a non-standard form → pick the standard equivalent; «Англіцизми» (`anglicism`), the same with anglicisms only.
- «Вислови»: «Фразеологізми» (`idiom-meaning`), an idiom or a proverb → pick its meaning; «Склади вислів» (`build-idiom`), assemble an expression from its words.
- «Виклик»: «Виживання» (`survival`), 3 Lives and no Round limit; «На час» (`timed`), 60 seconds and no Lives.

Editions may add modes through an Extension Point.

**Round**:
One prompt with exactly one right answer. The number and form of its options depend on the Game Mode: a pick of options, a tap on a vowel, a pair in a pairs grid, chips tapped in order, or typed text.
_Avoid_: Level, question

**Life**:
One allowed mistake in a Game Mode with Lives; a wrong answer costs a Life, losing all Lives ends the Game.
_Avoid_: Heart, attempt

**Distractor**:
A wrong option in a Round.

**Best result**:
The highest result of one finished Game in a Game Mode: the Rounds passed, or the right answers in «На час»; one per Game Mode per Edition. Stored, since finished Games are not kept, and written only when a finished Game beats it; a Game left before its end never counts.
_Avoid_: High score, top score

**Game Review**:
The result screen's list of every played Round in order, in every Game Mode: its prompt → its right answer, ✓ or ✗, with the reader's pick or typed text on a wrong answer; each pair of «Пари» is one row. A tap expands the Definition, Example and etymology (a Correction: the right form and the explanation; a Synonym Row: its members; a Tip: its explanation); a second tap opens the Entry. Its answers are kept only until the result screen and are not stored.
_Avoid_: Mistakes list, answer log

**Daily Crossword**:
«Кросворд дня»: one 5×5 mini crossword a day, the same for every reader on a local date, its clues the Definitions of Words and the explanations of Corrections. It is not a Game: it has no Rounds, no Lives, no Best result and no Game Review, and solving it makes nothing Seen and changes no Knowledge Mark.
_Avoid_: Daily puzzle, crossword game, Word of the Day
