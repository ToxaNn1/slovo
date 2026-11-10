# SLOVO

SLOVO helps people discover, learn and share rare words of a single language. It is built as a factory: one shared **Core** produces many single-language **Editions**.

## Language

### Factory

**Edition**:
One language inside the one SLOVO app (ADR 0065): its configuration and assets in the repository and its content in the Deployment's database (ADR 0090), with its UI language and content language the same, its own progress and its own localized store page. One Edition is active at a time. The first Edition is the UA Edition, Ukrainian, whose id is the language code `uk`; the label «UA Edition» names it in docs and code comments, and the id never changes.
_Avoid_: Flavor, variant, localization, separate app, Ukrainian Edition, UK Edition

**Language Pack**:
Everything that makes an Edition specific to its language: words, categories, UI strings and language traits (e.g. whether the language marks stress). Its SQLite pack is built at EAS build time from a snapshot of the Deployment's database and bundled with the app as its offline base, kept current by Patches; the live content is the database (ADR 0090).
_Avoid_: Locale bundle, dictionary

**Content update**:
The records of the Edition's content changed since the content version the app holds, fetched by the app by itself, without an Account, at launch, on return to the foreground and every 15 minutes, and applied at once over the bundled Language Pack as Patches; a device far behind gets one bigger Patch (ADR 0090).
_Avoid_: OTA (that is an update of the app's JavaScript), delta, whole pack

**Patch**:
The changed records of an Edition since a content version, whole records the app fetches and applies at once inside one transaction over its open Language Pack; the unit of a Content update. It carries a format number an older app may refuse, keeping what it has.
_Avoid_: Delta, diff (that is what the editor shows on a version conflict), OTA

**Content version**:
A per-Edition number the Deployment's database raises on every publish, a rollback included; it only grows, and two different contents never share one (ADR 0011, 0090). A record version is the per-record counter a save names and the server checks, refusing a save over a newer one.
_Avoid_: Pack version, checksum, revision

**Update channel**:
An Edition's stream of signed OTA updates to the app's JavaScript, named after the Edition id and bound to its builds; an update reaches only the builds whose native code it was made for, and the owner publishes one deliberately, to a share of readers first (ADR 0062).
_Avoid_: Release, release channel, branch

**Deployment**:
The one running backend that serves every Edition: one container image on Railway with its Postgres, which holds every Edition's content (ADR 0090), behind the app's domain (ADR 0063, 0065). Its secrets and addresses live in its environment variables, never in the repository.
_Avoid_: Env, prod, server (the backend is the code; the Deployment is its running copy)

**Owner admin**:
The Vite app `apps/admin`, served built by the backend at `/admin` on the Deployment, where the owner and admins run SLOVO (ADR 0088): seven sections, Огляд, Контент, Свічі, Аналітика, Якість, Розробка and Безпека, behind a global Edition and period filter. It imports only the contracts and talks to the backend over HTTP alone.
_Avoid_: Dashboard, back office, admin panel

**Admin user**:
A person or token that signs in to the Owner admin: a row of its own table with an email, a role, TOTP and sessions of its own, never an Account (ADR 0088).
_Avoid_: Account, user (a reader)

**Власник / Адмін / Агент**:
The three roles of an Admin user (ADR 0088). Власник does everything and makes the others; the first is made by `pnpm admin owner add`. Адмін does everything but Безпека. Агент is the service token a coding agent writes content with, one per agent, named in the Action log; in English, an Agent token.
_Avoid_: Admin (for Власник), bot, superuser

**Action log**:
The append-only record of every write through the admin API, the server commands included: who, when, what, the value before and after, and the reason (ADR 0088). Every change asks for a confirmation and a reason; an Entry save takes an optional one, an Owner check tick none.
_Avoid_: Audit trail, history, journal

**Content queue** («Черга контенту»):
The list under Контент in the Owner admin of agent Batches «не перевірено», of agents' and the quote check's flags on records, and of Mistake Reports awaiting the owner (ADR 0088, 0090).
_Avoid_: Inbox, moderation queue

**Batch** («пачка»):
The records one `pnpm content add|edit|flag` run adds or edits, published at once and reviewed afterwards in the Content queue; «Відкотити пачку» reverts it whole, new records to Retired and edits to their previous versions, skipping a record anyone changed after the batch (ADR 0090).
_Avoid_: Wave (that is the repo process of ADR 0080), PR, commit

**Owner check**:
A manual check the owner ticks in the Owner admin, kept in the database per version; agents add one through a command (ADR 0088).
_Avoid_: Checklist item, QA task

**Core**:
The language-agnostic behaviour and screens shared by every Edition. Editions never replace Core code.
_Avoid_: Engine, base app

**Feature Switch**:
A per-Edition setting for a Core feature (e.g. the Game) that the Edition declares `on`, `off` or `unavailable` in `edition.json`, and that a remote Rule set in the Owner admin can turn on or off for the readers it targets; `unavailable` nothing turns on (ADR 0089). Its effective value, which everything reads, is the first matching Rule's answer on the device, else the Edition's state, and every Feature Switch it depends on in effect (a Game Mode needs the Game, the Badges need the XP log); the Core's Edition module lists the dependencies, nothing else joins two switches.
_Avoid_: Toggle, flag (in conversation)

**`unavailable`**:
The Edition state of a feature it has no content or assets for (no Narrator Voice recordings, no Curated Collections): no control in the Owner admin, no Rule turns it on (ADR 0089).
_Avoid_: Disabled, hidden

**Rule**:
One remote Feature Switch setting: the readers it targets (Edition, app version, platform, the phone's region, a share of readers, signed in or not, a schedule) and on, off or a Variant; ordered per feature, the first match decides. A Rule the app doesn't understand is skipped (ADR 0089).
_Avoid_: Flag, override, condition

**Rollout**:
A Rule's share of readers in per cent, stable per device by the Install id hashed with the Rule id as salt, so a reader stays in or out as the share grows (ADR 0089).
_Avoid_: Percentage flag, canary

**Variant**:
One of two or three values of a Feature Switch under test, picked on the device by the Install id and sent to PostHog as a property of the Analytics events; with Analytics off it is picked and reported nowhere (ADR 0089).
_Avoid_: Experiment arm, A/B group, treatment

**Install id**:
The one random anonymous id the app makes at first launch and keeps until reinstall: the key of Rollouts and Variants and, while Analytics are on, the Analytics distinct id; with Analytics off it stays on the phone. Tied to no Account and no device identifier; never sent in a switch request, a Community Counter or a Mistake Report (ADR 0089).
_Avoid_: Device id, user id, anonymous id (the old ADR 0068 wording), installation id

**Force update**:
A soft and a hard minimum app version per Edition and platform set in the Owner admin and carried in the Rules answer; below the soft minimum the app shows a banner, below the hard one a blocking screen (ADR 0089).
_Avoid_: Forced upgrade, min version flag

**Kill switch**:
One click and a reason in the Owner admin that turns one feature off for every reader of one Edition or of every Edition over every Rule, fires a Telegram alert and lands in the Action log; from a shell, `pnpm switches off` (ADR 0088, 0089).
_Avoid_: Emergency flag, panic button

**Extension Point**:
A place the Core deliberately opens for an Edition to plug in its own behaviour or UI, such as extra Game modes, extra Word card sections or language services.
_Avoid_: Hook, override, plugin

**Decor**:
Purely visual elements an Edition supplies for the Core to draw: the Mascot's vector, the accessory it wears and the Category pictograms and covers. Decor never carries behaviour. While «Сезонний декор» is on, the Mascot wears the accessory of the local date's Holiday, or else of its Season; nothing else changes with the date.
_Avoid_: Skin, theme (a Theme is the user's light/dark choice)

**Season**:
The meteorological season of the reader's local date: December–February winter, March–May spring, June–August summer, September–November autumn. The Edition supplies a Mascot accessory for each; it changes at local midnight. Paused in the UA Edition in 1.0 with Holiday Decor behind its Feature Switch; the code stays.
_Avoid_: Time of year, theme

**Holiday**:
A date the Edition lists by a rule, a fixed day and month (24 August) or the nth weekday of a month (День вишиванки, the third Thursday of May), with its own Mascot accessory. On a Holiday its accessory shows instead of the Season's. Paused in the UA Edition in 1.0 behind the Decor Feature Switch; the code stays.
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
A PNG picture a Word may carry above its Definition, kept in the Media Store and cached on the device, not in the Language Pack; only the Starter Media's are bundled in the app. It is square, at most 150 KB, shown at most 160 pt high and the same in both Themes. Only Words carry Illustrations.
_Avoid_: Image, picture, Decor (Decor belongs to the Edition's look, not to Words)

**Retired Word**:
A Word marked Retired in the content database (never deleted), so it leaves the Language Pack and the Patches. It never appears in the Feed, notifications, widgets or the Game, but stays visible wherever the user already keeps it (Favorites, Collections, History).
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
A thematic group a Word or a Correction belongs to. Words and Corrections each have the Edition's own list: Words by what they name (e.g. human body, emotions, military), Corrections by where a reader meets them (e.g. at work, in a shop, transport). Every Word and every Correction has one Category of its list. Every Category carries a one-line description and a tone, loud or quiet; a quiet Category (e.g. the Words removed from dictionaries in the 1930s) has a quiet tile and a quiet screen without the Mix button or progress. A Category has a screen of its live Entries, opened from its grid (ADR 0081).
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
A Correction marked Retired in the content database (never deleted), so it leaves the Language Pack and the Patches. Like a Retired Word, it never appears anywhere new and is no longer linked from Words, but stays visible wherever the user already keeps it.
_Avoid_: Deleted correction

**Correction Type**:
Why the form is non-standard: russianism, calque, surzhyk, officialese (канцелярит), anglicism (англіцизм), an English borrowing where a dictionary word of the Edition's language serves, wrong stress (`wrongStress`, «наголос»: a stress trap, the right word said with the wrong Stress), or a paronym (`paronym`, «пароніми»: a word swapped for its look-alike of another meaning, e.g. «ефективна сукня» → «ефектна сукня»). The Dashboard shows a tile per Correction Type the Language Pack has Corrections for, with a screen listing its Corrections; a Correction is «розібрано» once Seen in any Cycle or revealed with «Як правильно?» on that screen.

**Idiom**:
A fixed expression whose meaning is not the sum of its words, with its Definitions, Examples and, where known, its origin, e.g. «бити байдики» → «ледарювати». The third kind of Entry (ADR 0046); a Core concept, each Edition supplies its own. An Idiom has an expression instead of a Lemma, and no Stress, part of speech, Category, rarity or Pronunciation. Its Ukrainian name is «фразеологізм».
_Avoid_: Phrase, expression (for the Entry; the expression is its text); saying or proverb for the Entry (a proverb is an Idiom of Idiom Type `proverb`)

**Idiom Type**:
What kind of fixed expression an Idiom is: `idiom` («фразеологізм»), an idiom proper; `placeName` («топонім»), a place name whose etymology tells the story of its name and is required; or `proverb` («прислів’я»), a proverb or saying. A place name and a proverb share the Idiom's card, Feed turn, Mix switch and lists; only the chip differs.
_Avoid_: Subtype, kind (a kind is Word, Correction, Idiom, Synonym Row or Tip)

**Retired Idiom**:
An Idiom marked Retired in the content database (never deleted), so it leaves the Language Pack and the Patches. Like a Retired Word, it never appears anywhere new, but stays visible wherever the user already keeps it.
_Avoid_: Deleted idiom

**Synonym Row**:
A dominant word with a short meaning line and a row of 5 to 12 of its synonyms, its members, each with its Stress and an optional note on its shade, e.g. «іти → простувати, чимчикувати, шкандибати». The fourth kind of Entry (ADR 0051); a Core concept, each Edition supplies its own. A member or the dominant may link a Word of the Language Pack, and that Word's card links back to the row («У синонімічному ряду: іти»). A Synonym Row has no Category, rarity or Pronunciation; a Retired one behaves like a Retired Word. Its Ukrainian name is «синонімічний ряд». Its members are not the Synonyms a Word lists.
_Avoid_: Synonym set, thesaurus

**Tip**:
A rule of good speech with its standard form, a short explanation and its own Game question, e.g. «Котра година?» instead of «Скільки час?». The fifth kind of Entry (ADR 0051); a Core concept, each Edition supplies its own. It may show a non-standard form, but needs none (the vocative «пане Андрію» has no wrong form to show). The boundary with a Correction: one form swapped for one standard form is a Correction; a rule, a construction, etiquette or punctuation is a Tip. A Tip has no Category, rarity or Pronunciation; a Retired one behaves like a Retired Word. Its Ukrainian name is «порада».
_Avoid_: Hack, advice, lifehack

**Entry card**:
How the app shows one Entry: a Word card, a Correction card, an Idiom card, a Synonym Row card or a Tip card in the same frame, with the action row (heart, Collections, share, hide, and the flag of «Повідомити про помилку») under it. With `swipeMarks` on, the action row moves to the card's top-right corner as heart, Collections and «⋯», whose sheet holds the mark items, share, hide and «Повідомити про помилку», and a side swipe sets a Knowledge Mark (ADR 0077). With `wordTabs` on, every card but the Word of the Day's is a fixed frame the height of the Feed's page (ADR 0091): a Word card with the tabs «Суть», «Приклад», «Зв’язки» and «Історія» under its Lemma, a Correction card with «Як краще», «Чому» and «Приклади» under its struck non-standard form, an Idiom card with «Суть», «Звідки» and «Приклад» under its expression, a Tip card with «Суть» and «Приклад», and a Synonym Row card in the same frame, empty tabs left out. Content too tall for the frame shrinks a font size at a time down to S, then is clamped under «Детальніше», which opens it whole and lets the page scroll. The Feed and every screen that opens a kept Entry show the same Entry card.
_Avoid_: Item, tile (for a card; a tile is the pressed button of the design)

### User's words

**Favorites**:
The single built-in list of Entries the user marked with the heart ("save word").
_Avoid_: Saved words, likes

**Dashboard**:
The home the app opens on, behind «Стрічка» unless `feedTab` makes that tab open the Feed (ADR 0093): the Word of the Day hero, the Mood check-in, «Попередні слова», the «Категорії» rail of Categories of Words, the «Добірки» rail of Curated Collections and the Correction Types rail, whose header opens the grid of the Categories of Corrections. Each block has its own Feature Switch; with `dashboard` off the Feed is the home.
_Avoid_: Home, start screen, overview

**Curated Collection**:
«Добірка»: an editorial list of Entries shipped in the Language Pack with a publish date, unlocking on it, shown on the Dashboard's «Добірки» rail; not a Collection, though «ДОДАТИ» copies it into one.
_Avoid_: Playlist, featured, set

**Collection**:
A list of Entries the user created and named; an Entry may be in many Collections. A Collection can be shared by a Collection Link, and «Додати собі» on a Collection Link, and «+ Додати» on a Curated Collection, copy it as the reader's own Collection, which syncs like any other; a copy of a Curated Collection remembers its source.
_Avoid_: Folder, playlist, list

**Collection Link**:
An immutable, never-expiring snapshot of a Collection on the server (its name and its Entry ids in order) behind `https://<domain>/<edition>/c/<id>` (the app's domain, the Edition's path), made by «Поділитися посиланням». Later edits to the Collection never reach it; sharing again makes a new link. Neither side needs an Account.
_Avoid_: Share link, invite

**Saved**:
Only the name of the tab that groups Favorites, Collections and History. Not a concept of its own.

**History**:
The most recent Seen Entries, newest first, without duplicates (a re-seen Entry moves to the top), capped at 500. Survives Cycles.
_Avoid_: Recent, log

### Progress

**Active Day**:
A local calendar day on which the reader met the Daily Goal set for it (a `goal-met` record) or, on a day with no Daily Goal, earned at least 5 XP from learning actions (ADR 0074). Active Days recorded before 1.0, when a day on which the app was opened was an Active Day, stay Active Days. Derived from the XP log and the kept earlier days, never stored on its own.
_Avoid_: Opened day, visit day

**Streak**:
The number of consecutive Active Days up to today. A Streak freeze covers a missed day and a Break bridges its days without adding to the count; a missed day with no freeze and no Break resets the Streak, with no repair. Always derived from the XP log by local date, with the freezes and Breaks, never stored on its own.
_Avoid_: Chain, run

**Best Streak**:
The longest Streak the reader has ever had, derived like the Streak and never stored; a reset of the Streak leaves it.
_Avoid_: Top streak, longest chain

**XP**:
The points a learning action earns: a right answer in a Game (1 per Round), a finished Game with at least half the answers right (+5), a new Best result in a Game Mode (+5), the solved Daily Crossword (15), a Review answer, Known or Unknown (1, at most 10 a day), a right answer to a Quick Question (2), and a Word Seen for the first time, in no earlier Cycle and not in History, on a day with a Daily Goal (1, up to the goal; Games stay uncapped beside it). These are the UA Edition's defaults; the Edition config holds the amounts. Known on a new Entry, Learned, a Streak day, the first visit of the day, sharing and the Word of the Day give 0. A mistake never takes XP away, and a Game has no daily XP cap. Badges give no XP.
_Avoid_: Points, score, coins, experience

**XP log**:
The append-only record of the reader's progress, kept per Edition: XP records, the Daily Goal set (`word-goal`) and met (`goal-met`) for a day, a freeze consumed, a Break started, a Badge earned, a Badge opened (`badge-opened`, which ends its «НОВА» mark on every device) and a wrong answer in a Game (`wrong-answer`, which earns no XP and feeds the `rightRun` Badge). Every record has a unique id, a local date and a time. Sync merges XP logs as a set union by id, so two devices never double the XP. Total XP, Level, today's XP, Active Days, Streak, Best Streak, freezes held and Break eligibility are derived from it and never stored.
_Avoid_: XP history, score table, ledger

**Level**:
A step derived from total XP: 50 XP reach level 1, each level up to 10 costs 10% more than the one before, then every level costs 120 XP, with no top. The Edition supplies a name for every five levels. A Level locks nothing.
_Avoid_: Rank, tier, grade

**Daily Goal**:
The number of Words Seen the reader aims for on a local day: one of the Edition's options (10, 25 or 50 in the UA Edition), chosen in onboarding with 10 highlighted, or none when skipped (ADR 0074). Only Words count. It is recorded in the XP log as `word-goal` (the last set on or before a day is in force) and met once by a `goal-met` record, so a past day keeps the goal the reader had then; a change applies from the same local day and a day already met stays met. «Без цілі» in Settings turns it off the same way, a `word-goal` with none. It replaces the Daily Limit.
_Avoid_: Target, quota, Daily Limit

**Streak freeze**:
A cover for one missed day that keeps the Streak, used automatically. A new reader holds 2, one is added for every 7 Streak days, and at most 2 are held at once.
_Avoid_: Streak saver, repair, shield

**Break**:
A pause of the Streak the reader starts: up to 7 days, once every 30 days, free. Break days keep the Streak and add nothing to it.
_Avoid_: Vacation, pause (the polite pause is a notification rule), repair

**Badge**:
A kept milestone, about 20 in all: Streak days, confirmed learned Entries, the first win in each group of Game Modes, Daily Crosswords in a row, the first right Game answer on a rarity-5 Word Levels, a flawless Game and a run of right answers. Every Badge belongs to one Badge family. A win for a Badge is a finished Game with at least half the answers right. The Core holds a catalogue of conditions; an Edition chooses its Badges, names them and adds its own from the catalogue's parameterised kinds. A Badge is never taken away, keeps the date it was earned, syncs through the Account and gives no XP.
_Avoid_: Achievement, trophy, medal

**Badge family**:
A group of Badges an Edition declares, with a name, a description, a shape and a tone that every Badge in it is drawn with. The shapes are `hexagon`, `shield`, `circle`, `tile`, `wedge`, `diamond` and `checker` (ADR 0087). The UA Edition has six. A Badge earned but never opened is new and carries «НОВА».
_Avoid_: Badge category, Badge group, tier

**Profile**:
The screen of the reader's whole progress: Level and progress to the next, Streak, Best Streak, the Active Days calendar (the last 35 days across months, with Break and frozen days), confirmed learned Entries by rarity, Badges with progress, the Best result of each Game Mode and a button to share the Level; the reader's earlier numbers (Seen, Favorites, Known, Game results) stay available. Without an Account it offers to save the progress.
_Avoid_: Account (the identity that syncs), dashboard, stats screen

**Mascot**:
The Edition's character, a silent figure that moves and shows short lines from the Edition in onboarding, celebrations (a new Level, a Badge, the Daily Goal, Streak milestones), Game reactions and empty states, and never interrupts the Feed. The Edition supplies its vector; the Core draws its states and their motion (ADR 0070). It makes no sound: the interface sounds of the app are not its voice.
_Avoid_: Avatar, bot, assistant, voice (of the Mascot)

**Interface sound**:
One of the short sounds the app plays for a shout, a right answer, a wrong answer or a tap, behind the `sounds` Feature Switch and the «Звуки» setting. It belongs to the interface, never to the Mascot.
_Avoid_: Voice, music, notification sound (that is the sound of a notification)

**Account**:
The optional identity that keeps a reader's words and progress across devices, called SLOVO ID in code and docs, and shown to the reader under the name its Edition gives it (set in the Edition's config). One Account works in every Edition; each Edition's data stays separate. An email has one Account, which every Sign-in method reaches: a Sign-in code, Sign in with Google or Sign in with Apple. Knowledge Marks, the XP log and Badges sync through it. Without an Account everything lives on the device only.
_Avoid_: Cabinet, login, admin user (the admin's own sign-in, not an Account)

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
The vertical stream of Entries the user swipes through, opened from the Dashboard (the home screen when `dashboard` is off); Corrections, Idioms, Synonym Rows and Tips are mixed in among Words. Every 5th card of the Cycle is a Correction's turn while the Cycle has unseen Corrections, every 7th an Idiom's turn while it has unseen Idioms, every 9th a Synonym Row's turn while it has unseen Synonym Rows and every 11th a Tip's turn while it has unseen Tips, each counted from its kind's last card, at the Mix kind weight «Звичайно» («Менше» spaces a kind's turns twice as far apart, «Більше» twice as close). When turns fall on one card the order is Correction, Idiom, Synonym Row, Tip, and each loser takes the next card. While Entries are due for Review, every 3rd card that is no other kind's turn is a Word due for Review, labelled «Повторення», and a Correction, an Idiom, a Synonym Row or a Tip due for Review takes the next turn of its kind before a new one, Seen in this Cycle or not. The Word of the Day and the Review slot stay Words only. Beside Entry cards the Feed shows Feed Notices, which take no turn.
_Avoid_: Timeline, home list, home screen

**Feed Notice**:
A Feed card that is not an Entry, shown one at a time. The 1.0 list: the Weekly Recap, the Community Word, a first-week card, «Пам’ятаєш вчорашнє слово?» (yesterday's Word of the Day in Self-check style), «Може, на сьогодні досить?», a Level milestone at Levels 5, 10 and 20 that suggests a wider rarity or a new Category, the offer to save progress, the later onboarding questions and the notification re-ask. «Може, на сьогодні досить?» comes once a local day after 50 distinct Seen Entries, has no setting and never locks the Feed. The save-progress Notice comes without an Account on day 3 of the Streak and after the first new Level, at most twice in all; the notification explainer and its re-ask, 7 days after a refusal, once, come only to a reader who did not answer «Коли нагадати?» in onboarding (ADR 0074). A reader who finished the old onboarding gets the Daily Goal choice once through a Feed Notice. In the Feed a Feed Notice comes before a due Review, a due Review before a Quick Question and a Quick Question before the rest. It counts in no turn and no Review slot and makes nothing Seen; swiping past it closes it for the local day.
_Avoid_: Banner, tip (a Tip is an Entry)

**Seen**:
An Entry is Seen in the current Cycle once its card stayed on screen for a minimum dwell time in the Feed, or the user opened it from a notification or widget. The Dashboard's reveal of the Word of the Day makes it Seen, through the Feed's own Seen. Opening an Entry from Search, «Попередні слова», a Curated Collection or a Correction Type, the Rarity Test and Feed Notices make nothing Seen.
_Avoid_: Viewed, read

**Cycle**:
One pass through all eligible Entries. When every Entry is Seen, the user is told to wait for new Words, and the next swipe starts a new Cycle in which nothing is Seen yet.
_Avoid_: Round (that is a Game term), loop

**Knowledge Mark**:
What the reader says about an Entry on its card: Known («Знаю») or Unknown («Не знаю»). Tapping the other mark changes it, tapping the same one again removes it. With `swipeMarks` on, a side swipe sets it instead (right Known, left Unknown) or the «⋯» sheet does; a repeated swipe to the same side changes nothing, only «Зняти позначку» removes it, and undo within 4 s restores the previous state (ADR 0077). A mark set from 0.8.13 on keeps the time it was set; only marks with a time count in a Weekly Recap. On a Correction, Known means "I already say it right". A mistake in any Game Mode is an Unknown mark; there is no separate list of hard words.
_Avoid_: Rating, grade

**Review**:
An Entry coming back to the Feed after 1, 3, 7, 30 or 90 local days. Unknown starts it at 1 day; Known on a Review moves it to the next step; Unknown at any step starts again at 1 day. Entries on the old 7-day step move on to 30 days. A Review overrides Seen: a due Entry comes back even if it is Seen in the current Cycle. Game answers never move a Review, except that a wrong answer marks the Entry Unknown.
_Avoid_: Repeat, flashcard, spaced repetition

**Due**:
An Entry is due for Review on or after its Review day, and stays due until the reader marks it. A Hidden Entry or an Entry that is not eligible is skipped until it is eligible again.

**Learned**:
An Entry that is Known on its 90-day Review. It stops coming back for Review and stays in the Cycle. Badges and the Profile count confirmed Entries: an Entry is confirmed when it is Known on a Review of 7 days or later, or answered right in a Game or a Quick Question.
_Avoid_: Mastered

**Self-check**:
A setting («Перевір себе», off by default) that hides the answer on an Entry card until the reader taps: a Word card shows only the Lemma with Stress, part of speech and Category, a Correction card only the non-standard form, an Idiom card only the expression and the chip of its Idiom Type, a Synonym Row card only its dominant («іти → ?»), a Tip card only its title and its non-standard form (only the title when it has none). The Knowledge Mark buttons work only after the reveal. It applies to the Feed, the Word of the Day included, and not to the widget or Share Cards.
_Avoid_: Quiz mode, test mode

**Mix**:
The set of Categories of Words, plus Corrections as a whole with their own Categories under it, plus Idioms, Synonym Rows and Tips each as a whole, that the reader chose to see in the Feed, notifications, widgets and the Game. At least one Category of each list always stays in the Mix. The Mix also holds the Mix kind weights and the frequency of the Quick Question; rarity is the Rarity Ceiling, a setting of its own.
_Avoid_: Filter, preferences

**Rarity Ceiling**:
«Рідкість»: the highest rarity of Words the reader wants, «до 1» to «до 5», default «до 5». Only Words up to that rarity appear anywhere new: the Feed, notifications, widgets, every Game Mode and the Daily Crossword. Entries of other kinds have no rarity and are not affected. A setting of its own, not part of the Mix; set in Settings, by onboarding's «Хто ви» and by the Rarity Test. There is no lower bound.
_Avoid_: Rarity Floor, difficulty, level, maximum difficulty

**Mix kind weight**:
«Менше», «Звичайно» or «Більше» for each of Corrections, Idioms, Synonym Rows and Tips in the Mix; Words fill the rest. «Вимкнено» stays a separate switch per kind. The questionnaire's «Навіщо» sets the starting weights.
_Avoid_: Ratio, priority

**Quick Question**:
A Feed slot that shows one Round from an enabled Game Mode over an Eligible Entry. The Mix sets its frequency: off, every 20th, every 10th (default) or every 6th card. A right answer earns 2 XP; a wrong one marks the Entry Unknown. It makes nothing Seen beyond its Entry's own rules.
_Avoid_: Pop quiz, Feed Game

**Questionnaire**:
The questions that tune the Feed to the reader. Onboarding asks two: «Рівень», how well the reader knows the language (sets the Rarity Ceiling, «Тільки починаю» «до 2» to «Мовний гурман» «до 5»; «Не знаю» opens the Rarity Test, whose result sets it) and «Навіщо» (sets the Mix kind weights); skipping them keeps the defaults. The interests question (unselected Categories become Hidden Categories), the vocabulary self-rating (decides whether to offer the Rarity Test) and the Mix review come later through Feed Notices. The reader can retake it from Settings, «Рівень» there without «Не знаю». Its answers reach the owner only as anonymous counters and as properties of the anonymous Analytics id.
_Avoid_: Survey, form

**Hidden Entry**:
An Entry the user disliked; it never appears in the Feed, notifications, widgets or the Game again unless unhidden. Any kind of Entry can be hidden from its card, and the Hidden screen lists Hidden Entries by kind, Synonym Rows («Синонімічні ряди») and Tips («Поради») included, while the Edition turns the kind on.
_Avoid_: Disliked, blocked, muted, hidden word

**Hidden Category**:
A Category, of Words or of Corrections, the user took out of their Mix, whether from the Mix itself, from a card's hide action or on the Hidden screen. Hiding a Category and taking it out of the Mix are one and the same; its Words or Corrections are excluded from everything new the same way as a Hidden Entry.
_Avoid_: Muted topic

**Eligible Entry**:
An Entry that may appear anywhere new (the Feed, notifications, widgets, the Game): not Retired, of a kind whose Feature Switch is in effect, in the user's Mix (a Word of a Category in the Mix within the Rarity Ceiling; a Correction while Corrections and its Category are in; an Idiom while Idioms are in; a Synonym Row while Synonym Rows are in; a Tip while Tips are in) and not Hidden. An Entry that is not eligible stays visible wherever the user already keeps it.
_Avoid_: Available, visible, active entry

**Comparison Key**:
The form a text is compared by, which the Core gives from the Edition's Language Traits for one purpose: a typed answer in the Game, a Search query, or a Definition or option among Distractors. Every Comparison Key folds case with the Edition's locale, takes out Stress marks, writes each character the Edition reads as an apostrophe as one and drops spaces at the ends; a Search query's also reads the Edition's Search letters alike (г/ґ, е/ё), and a Definition's reads the spaces between words as one. Two texts match when their Comparison Keys are equal.
_Avoid_: Normalized text, search key, folded form

**Search**:
«Пошук»: finding Entries by their visible text, behind a magnifier in the «Стрічка» header. It covers every Entry of a kind the Edition turns on that is neither Retired nor Hidden, the Mix and the Rarity Ceiling aside, and ignores case, Stress, the kind of apostrophe, г/ґ and е/ё. A text matches from 2 characters when it or one of its words starts with the query; «За значенням», from 3 characters, finds Words by their Definition and the Synonym Rows that contain the query. Opening a result makes nothing Seen. The last 10 queries stay on the device.
_Avoid_: Lookup, filter, dictionary

**Rarity Test**:
«Перевірка рівня»: 10 Words, 2 of each rarity, each shown as its Lemma with Stress for «Знаю» or «Не знаю», which set the Rarity Ceiling to the lowest rarity with «Не знаю» («до 5» if all are known). Optional in onboarding after the Mix and again from Settings. It sets no Knowledge Mark, starts no Review and makes nothing Seen.
_Avoid_: Level test, placement test, quiz

**Weekly Recap**:
«Ваш тиждень»: a Feed Notice on the first open of a local Monday about the Monday–Sunday week before it: the Entries Seen, the Favorites added, the Known marks set in that week (left out with the Knowledge Marks off) and the current Streak, with a Share Card. No Weekly Recap follows a week without an Active Day.
_Avoid_: Weekly report, digest, summary

**Community Word**:
«Слово тижня спільноти»: a Feed Notice on a local Monday right after the Weekly Recap, showing the Entry readers most added to Favorites in the last ISO week (the lower id on a tie) as a mini Entry card with «додали {n} читачів». There is none when nobody added anything or the Entry is Hidden or Retired for the reader. A tap opens the Entry.
_Avoid_: Word of the week, top word, trending word, Word of the Day

**Community Counters**:
Anonymous counts of how many readers know an Entry, don't know it and saved it, shown under its mark buttons as «Знають {known} з {total} читачів · зберегли {saved}», and of its Favorites adds per ISO week, which choose the Community Word. A device sends only the changes it made itself after the update, with no Account, no device id and no Install id, never Game answers, and nothing while «Ділитися анонімною статистикою» is off; the server keeps totals, never one reader's marks. They are not Analytics.
_Avoid_: Stats, statistics (the reader's own numbers), ratings

**Analytics**:
Reader-consented product events (onboarding steps, Games, Review, goals, Streak events, settings, screens) sent with the Install id as the distinct id through one port of the Core, to measure retention and goal completion. No advertising id, no location, no contacts, no session recording and no tracking prompt. One Settings switch, «Ділитися анонімною статистикою», turns off both Analytics and Community Counters. Distinct from Community Counters, which count Entries and never events.
_Avoid_: Tracking, telemetry, stats (the reader's own numbers)

**Mistake Report**:
«Повідомлення про помилку»: what a reader sends from an Entry card's menu about a mistake in that Entry: its type (typo, Stress, Definition or other), an optional comment of at most 500 characters (required for other), the Edition, the Entry id, the app version and the content version. It carries no Account, no device id and no Install id, waits on the device until it can be sent, and is kept on the server until the owner resolves it in the Owner admin's Content queue.
_Avoid_: Bug report, feedback, complaint

**Daily Limit**:
Retired in 1.0. The old setting «Ліміт на день» is replaced by the Daily Goal and by the Feed Notice «Може, на сьогодні досить?» after 50 Seen Entries. The word survives only in history, in ADR 0054.
_Avoid_: use Daily Goal or the 50-Seen Notice

**Mood**:
«настрій»: a set of Feed parameters the reader chooses once a local day on the Dashboard: a rarity band inside the Rarity Ceiling (never crossing or lowering it) and a shift of each Mix kind weight. The Edition lists its moods (id, name, emoji) and names the four the Dashboard shows. The choice can be skipped or changed, ends with the local day and syncs; no Mood means the Feed as before.
_Avoid_: Emotion, feeling, vibe, roulette

**Reserved**:
A Word already promised to a scheduled notification, so no other notification picks it. Reserved is not Seen.

**Notification time**:
One of the user's local times of day at which a notification comes, such as 09:00. A new user has the Edition's default times; in onboarding «Коли нагадати?» offers the three times of the Edition config, morning, midday and evening (UA 09:00 / 13:00 / 20:30), «Інший час» and «Без нагадувань», and the answer replaces them (ADR 0074). The user may keep up to 10, no two equal, always in time order. With none left, notifications are off. Notification times stay on the device. Notifications come at most 14 days after the user last opened the app: the last one of the 14th day is a farewell with no Word, and nothing comes after it until the next open. From 1.0 the morning notification is the Word of the Day and one evening notification chooses between the Streak warning (Streak of 7 days or more, today below 5 XP, no freeze held) and «Ціль ще не виконана» (while the Daily Goal is not met), or nothing; at most 2 a day and the polite pause cover all of them, and the farewell «Ми зупиняємо нагадування» comes on the 14th day without opening.
_Avoid_: Reminder, alarm, schedule

**Word of the Day**:
One unseen Word fixed for the user's local calendar day; it is revealed on the Dashboard, opens the Feed and is the morning notification. Each day its card was Seen joins the reader's archive «Слова дня» in Saved, synced, newest first; a Retired Word stays there.
_Avoid_: Daily word

**Pronunciation**:
The Word read aloud by a recorded narrator voice; the device's voice when a Word has no recording (ADR 0083).
_Avoid_: Audio, TTS

**Narrator Voice**:
One of the Edition's recorded voices that read Words. The reader chooses one in Settings › «Голос диктора», behind the `narratorVoice` Feature Switch; a tap on a voice chooses it and reads the Edition's sample Word in it (UA: заграва). The Edition config declares each with a display name and a description, and one as the default (UA: Оксана), which reads while the switch is off.

**Recording**:
A Narrator Voice reading one Word, made ahead of time and keyed by Word id, Narrator Voice and Recording Kind. Recordings live in the Media Store and are cached on the device; only the Starter Media's are bundled in the app. Corrections, Idioms and Synonym Row members have none.

**Recording Kind**:
How a Recording reads its Word. The first and only Kind is `plain`, the Lemma in its first Stress; each later Kind comes with its own Feature Switch.

**Media Store**:
The Deployment's file storage for Recordings and Illustrations: Cloudflare R2 behind Cloudflare's CDN, at public URLs that carry the file's content hash. Postgres describes each file; the Media Store holds it.
_Avoid_: bucket, CDN (as names of the whole), assets (assets are the Edition's own files in the repo)

**Starter Media**:
The media the app bundles so a first launch works offline: the default Narrator Voice's Recordings of the first 300 Words of the default Mix, the sample Word in every voice, and those Words' Illustrations.

**Needs new recording** («потребує нового запису»):
The mark on a Word whose text or stress changed in the content database; Pronunciation hides for it until a Recording of the new text ships in a build (ADR 0090).
_Avoid_: Stale audio, outdated recording

**Share Card**:
A branded image of an Entry, of the reader's Weekly Recap («Мій тиждень у SLOVO»), of their progress on the day it happens (a Level reached, a Badge earned, a Streak milestone), or of a solved Daily Crossword's grid without its letters, made for sharing outside the app.
_Avoid_: Screenshot

**Widget Mode**:
What a home-screen widget shows, chosen per widget: Улюблене (the Favorites), one Collection, or Усі слова (every Eligible Entry). Every mode shows only Eligible Entries.
_Avoid_: Game Mode, filter

**Widget Snapshot**:
Everything each Widget Mode may show, decided by the Core and ready to draw, which the app writes into the App Group for the widget to read. It also says whether today's Word of the Day was Seen (`wordOfTheDaySeenOn`). It may carry the goal ring, today's Daily Goal progress and the Streak (`goalRing`), and whether the lock-screen widget is on (`lockScreenWidget`). The widget reads nothing else.
_Avoid_: Widget cache, widget database

**Spotlight Snapshot**:
What the iPhone search may find, decided by the Core: each Entry in Favorites, any Collection or the Word of the Day archive once, and each Collection as «Колекція · {n} слів», Hidden and Retired Entries left out. A local Swift module writes it into CoreSpotlight, replacing the whole index; with `spotlight` off it is empty.
_Avoid_: Search index cache

### Game

**Game**:
A run of Rounds in one Game Mode: up to 15 Rounds with 5 Lives by default. A Game Mode may set its own Lives, Round limit and time limit: «Виживання» has 3 Lives and no Round limit, «На час» 60 seconds and no Lives. In every Game Mode up to 5 Rounds are drawn from eligible Entries that are Unknown or due for Review, the rest as before; a wrong answer marks the Entry Unknown. At its end the Game shows its Game Review. The Daily Crossword is not a Game.
_Avoid_: Quiz, practice, test

**Game Mode**:
The kind of challenge in a Game. A Game Mode sets its Lives (or none), its Round limit (or none), its time limit (or none), the form of its answers and the group of the mode screen it stands in, and has its own Feature Switch. The Core modes, in four groups:

- «Слова»: «Вгадай слово» (`guess-word`), a Definition → pick the Word, getting harder as it goes (Rounds 6–10 an Example with a gap, Rounds 11–15 a Definition → type the Word); it asks about idioms of Idiom Type `idiom` the same way, with four idioms (place names never play), about Synonym Rows with «Що є синонімом до „{домінанта}“?», one member of the row right and members of other rows wrong (only while the Mix holds at least 4 Synonym Rows), and about Tips, each with its own Game question; «Наголос» (`stress`), tap the stressed vowel; «Пари» (`pairs`), match 4 Words to 4 Definitions; «Анаграми» (`anagram`), assemble the Word from shuffled letters; «За буквами» (`by-letters`), tap letter tiles into the slots by the Definition (no typing, no opened letters); «Впиши слово» (`type-word`), a sentence with a non-standard form → type the standard form; «Звідки слово» (`origin`), pick the language a Word came from.
- «Виправлення»: «Обери правильне» (`correction`), a sentence with a non-standard form → pick the standard equivalent; «Англіцизми» (`anglicism`), the same with anglicisms only.
- «Вислови»: «Фразеологізми» (`idiom-meaning`), an idiom or a proverb → pick its meaning; «Склади вислів» (`build-idiom`), assemble an expression from its words.
- «Виклик»: «Виживання» (`survival`), 3 Lives and no Round limit; «На час» (`timed`), 60 seconds and no Lives.

Editions may add modes through an Extension Point.

**Round**:
One prompt with exactly one right answer. The number and form of its options depend on the Game Mode: a pick of options, a tap on a vowel, a pair in a pairs grid, chips tapped in order (letter tiles with decoys included), or typed text.
_Avoid_: Level, question

**Answer Form**:
The form a Round's answer takes, which the Game Mode decides: a pick of options, a tap on a vowel, a pair in a pairs grid, chips tapped in order, or typed text. Each Answer Form owns what a Round in it holds, the Round the reader sees, how an answer is judged, what the Game Review shows of a wrong answer and how many Rounds and Entries it spans; the Game keeps only Lives, Rounds passed, the Best result and the timer.
_Avoid_: Question type, answer type, input mode

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
«Кросворд дня»: one 5×5 crossing crossword a day, the same for every reader with the same Rarity Ceiling on a local date (ADR 0087). Its blocks leave runs of white cells, each run a Word within the Rarity Ceiling, Hidden Entries included, numbered where it starts; across and down Words cross and share their letters, and a few crossing cells come pre-filled. One clue at a time, the current Word's primary Definition, is entered on the Letter Wheel. Solving it earns XP once a day; it is not a Game. Off `crossingCrossword`, the traced grid of ADR 0073 stays.
_Avoid_: Daily puzzle, crossword game, Word of the Day

**Letter Wheel**:
The Daily Crossword's ring of the current Word's letters, repeats kept, plus one decoy letter of the Edition's alphabet, shuffled by the day's seed and traced with a finger to enter the Word (ADR 0087).
_Avoid_: keyboard, letter circle

**Crossword Hint**:
«Підказка»: fills the first empty letter of the Daily Crossword's current Word; it costs nothing and only marks the day as hinted, so its solve shows no «без підказок» (ADR 0087).
_Avoid_: reveal, help

**Solve time**:
The seconds the Daily Crossword was on screen until it was solved, kept and synced with its XP log record; a solve recorded before it has none (ADR 0087).
