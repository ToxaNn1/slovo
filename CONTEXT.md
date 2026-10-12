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

**Core**:
The language-agnostic behaviour and screens shared by every Edition. Editions never replace Core code.
_Avoid_: Engine, base app

**Feature Switch**:
A per-Edition on/off setting for a Core feature (e.g. the Game), set in the Edition or remotely.
_Avoid_: Toggle, flag (in conversation)

**Extension Point**:
A place the Core deliberately opens for an Edition to plug in its own behaviour or UI, such as extra Game modes, extra Word card sections or language services.
_Avoid_: Hook, override, plugin

**Decor**:
Purely visual elements an Edition supplies for slots the Core defines, such as backgrounds or an embroidery-style ornament divider. Decor never carries behaviour.
_Avoid_: Skin, theme (a Theme is the user's light/dark choice)

### Entries

**Entry**:
Anything the user can discover, keep and share: either a Word or a Correction. Favorites, Collections, History, Seen and the Feed all work with Entries.
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
The stressed vowel position(s) of a Lemma; a Lemma may have more than one valid Stress. Only exists in Editions whose language marks stress.
_Avoid_: Accent

**Definition**:
The explanation of one meaning of a Word, written in the Edition's language. A Word has one primary Definition and may have more.
_Avoid_: Description, meaning, explanation

**Example**:
A sentence showing the Word in use.
_Avoid_: Usage, sample

**Synonym**:
A word with a close meaning, shown to help understanding.

**Category**:
A thematic group a Word belongs to (e.g. human body, emotions, military).
_Avoid_: Topic, tag, theme

**Rare Word**:
The editorial standard for every Word: a normative dictionary word that an educated native speaker most likely doesn't know or hardly uses, but is worth knowing. It excludes profanity, surzhyk and russianisms, narrow jargon and proper names. Each Word carries a rarity from 1 ("heard it, never use it") to 5 ("almost nobody knows it").

**Correction**:
A non-standard form people commonly use (often a phrase) paired with one or more standard equivalents in the Edition's language, plus a short neutral explanation, e.g. «на протязі року» → «протягом року». A Core concept; each Edition supplies its own Corrections. A Word may point to the Corrections it is the standard form for (протягом → «на протязі»), so each is reachable from the other without duplicating data.
_Avoid_: Mistake, error, surzhyk card

**Retired Correction**:
A Correction withdrawn from the Language Pack. Like a Retired Word, it never appears anywhere new and is no longer linked from Words, but stays visible wherever the user already keeps it.
_Avoid_: Deleted correction

**Correction Type**:
Why the form is non-standard: russianism, calque, surzhyk or officialese (канцелярит).

**Entry card**:
How the app shows one Entry: a Word card or a Correction card in the same frame, with the action row (heart, Collections, share, hide) under it. The Feed and every screen that opens a kept Entry show the same Entry card.
_Avoid_: Item, tile

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

**Account**:
The optional identity ("SLOVO ID") that keeps a user's words and progress across devices. One Account works in every Edition, and each Edition's data stays separate. Without an Account everything lives on the device only.
_Avoid_: Cabinet, profile, login

### Discovery

**Feed**:
The vertical stream of Entries the user swipes through on the home screen; Corrections are mixed in among Words.
_Avoid_: Timeline, home list

**Seen**:
An Entry is Seen in the current Cycle once its card stayed on screen for a minimum dwell time in the Feed, or the user opened it from a notification or widget.
_Avoid_: Viewed, read

**Cycle**:
One pass through all eligible Entries. When every Entry is Seen, the user is told to wait for new Words, and the next swipe starts a new Cycle in which nothing is Seen yet.
_Avoid_: Round (that is a Game term), loop

**Mix**:
The set of Categories, plus Corrections as a whole, that the user chose to see in the Feed, notifications and widgets.
_Avoid_: Filter, preferences

**Hidden Entry**:
An Entry the user disliked; it never appears in the Feed, notifications, widgets or the Game again unless unhidden.
_Avoid_: Disliked, blocked, muted, hidden word

**Hidden Category**:
A Category excluded from everything the same way as a Hidden Entry.
_Avoid_: Muted topic

**Eligible Entry**:
An Entry that may appear anywhere new (the Feed, notifications, widgets, the Game): not Retired, of a kind the Edition turns on, in the user's Mix and not Hidden. An Entry that is not eligible stays visible wherever the user already keeps it.
_Avoid_: Available, visible, active entry

**Reserved**:
A Word already promised to a scheduled notification, so no other notification picks it. Reserved is not Seen.

**Word of the Day**:
One unseen Word fixed for the user's local calendar day; it opens the Feed and is the morning notification.
_Avoid_: Daily word

**Pronunciation**:
The Word read aloud by the device's voice for the Edition's language.
_Avoid_: Audio, TTS

**Share Card**:
A branded image of a Word made for sharing outside the app.
_Avoid_: Screenshot

### Game

**Game**:
A run of up to 15 Rounds in one Game Mode, with 5 Lives.
_Avoid_: Quiz, practice, test

**Game Mode**:
The kind of challenge in a Game. The Core mode is Definition → pick the Word; the Correction mode is a sentence with a non-standard form → pick the standard equivalent. Editions may add modes through an Extension Point.

**Round**:
One prompt with four options, exactly one correct.
_Avoid_: Level, question

**Life**:
One allowed mistake; a wrong answer costs a Life, losing all Lives ends the Game.
_Avoid_: Heart, attempt

**Distractor**:
A wrong option in a Round.
