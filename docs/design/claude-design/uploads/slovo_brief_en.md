# Claude Design prompt: SLOVO (UA Edition)

> How to use: paste everything below the line into Claude Design. Add your references in the **References** section at the end before sending. Sample words are placeholders that show realistic content lengths.

---

## 1. What we are designing

**SLOVO** is an iOS app, like Instagram but for rare words. It helps people **discover, learn and share rare words** of their native language. You swipe through a vertical feed of word cards, keep the ones you like, share them as beautiful images, and practise them in a small game.

This brief covers the **UA Edition**: the whole UI and all content are in Ukrainian. The closest existing product is **"Vocabulary – Learn words daily"** (Monkey Taps). SLOVO should feel just as calm and focused, but warmer and more cultural.

**Audience:** Ukrainian speakers aged 16–45 who love their language and want to speak it more richly. They read on their phone in short moments: morning coffee, commute, before sleep.

**Feeling:** calm, literary, a bit precious, like opening an old good book. Not gamified-noisy, not childish.

## 2. The factory constraint (important)

SLOVO is a **factory**: one shared **Core** design powers many single-language apps (Polish, Armenian, Azerbaijani … later). So please design in two layers:

1. **Core design system:** neutral, elegant and complete on its own. All layouts, components and states.
2. **UA Edition skin** on top: design tokens (colours, typography) and **Decor**, a set of purely visual elements in predefined slots. The Ukrainian Decor is inspired by **vyshyvanka embroidery**. Think a thin golden zig-zag/cross-stitch ornament used as a divider on a dark background (see references).

A second Edition must be possible by only swapping tokens and Decor, never layouts. Please show this: render one screen (the word card) in the neutral Core skin and in the Ukrainian skin side by side.

**Decor slots** (the Core provides a neutral default for each):

1. Screen background (colour / gradient / texture / pattern)
2. Ornament divider between blocks of the word card
3. Word card frame or corner ornaments
4. Empty-state illustration ("no more words", empty Favorites, …)
5. Share Card frame / styling
6. Game victory illustration
7. Splash / launch screen

Each slot needs a light and a dark variant.

## 3. Platform & system

- iPhone, iOS 17+, portrait. Design at 393×852 (iPhone 15/16) and check 375×667 (SE).
- **Themes:** System / Light / Dark. Both themes are first-class.
- **Font size setting:** S / M / L / XL scales the word card text, and the app also respects iOS Dynamic Type.
- **Typography must support Cyrillic and the combining acute accent (U+0301)** used to mark stress: «ке́бета», «веремі́я». The stress mark must render cleanly at every size. This is critical; please test it in the chosen fonts. Suggest a literary serif for the word itself and a clean sans for the UI.
- **Accessibility:** WCAG AA contrast in every theme including on Decor; touch targets ≥ 44×44 pt; a Reduce Motion variant for animations; everything labelled for VoiceOver.
- **Tab bar** (4 tabs, in this order): **Головна** (Home) · **Налаштування** (Settings) · **Гра** (Game) · **Збережене** (Saved).

## 4. Domain vocabulary (use these exact concepts)

- **Entry**: anything in the feed. It is either a **Word** or a **Correction**.
- **Word** has:
  - lemma with stress mark(s), since some words have two valid stresses;
  - part of speech;
  - primary definition (and optional extra definitions);
  - example sentence with author;
  - synonym(s);
  - category;
  - optional etymology;
  - optional register label (застаріле, діалектне, книжне, розмовне).
- **Correction**: a common non-standard form (russianism, calque, surzhyk, officialese) and its standard Ukrainian equivalent(s), with a short neutral explanation. Tone: **"Так часто кажуть → Українською краще"**. Never "wrong!", never shaming.
- **Favorites** (heart), **Collections** (user-named lists), **History** (last 500 seen).
- **Word of the Day**: the first card of the day.
- **Mix**: the categories the user wants to see.
- **Hidden Entry**: an entry the user disliked.
- **Streak**: consecutive days the user opened the app.

## 5. Screens to design

For every screen, show light and dark, plus empty, loading and error states where they apply.

### 5.1 Onboarding (4 screens, shown once)

1. Welcome: what SLOVO is, in one line, with a beautiful hero word.
2. Choose your Mix: category chips, plus "Усі", plus a "Виправлення" (Corrections) toggle.
3. Notifications: explanation, permission, three default times (09:00, 13:00, 19:00), editable.
4. (Later version, design now) "Увійти через SLOVO ID / Продовжити без акаунта".

### 5.2 Home: the Feed (most important screen)

- Full-screen vertical swipe feed, one card per screen.
- **Top-left:** Stats button (streak flame + number).
- **Word card:** lemma (large, with stress); part of speech; pronunciation button 🔊; ornament divider (Decor); definition; example in italics with author; synonym; category chip; register label if any. If the word is the standard form for a Correction, show a small line at the bottom: «💡 Часто кажуть: _на протязі_».
- **"Word of the Day" badge** variant of the card.
- **Correction card** variant: crossed-out/soft-muted non-standard form → highlighted standard form(s), type label (росіянізм / калька / суржик / канцелярит), explanation, ❌/✅ example pair. It must feel friendly, not like a red error.
- **Action row** under the card: ♥ Favorite · Share · Add to Collection · 👎 Hide ("не показувати").
- **"You've seen all the words"** card: "Ви переглянули всі слова — чекайте оновлення". The next swipe starts a new round.
- Micro-interactions: heart animation, swipe hint on first launch.

### 5.3 Stats sheet (from the top-left button)

Current streak and best streak; words seen today; Favorites count; words in Collections; best Game result.

### 5.4 Add to Collection sheet

A list of Collections with checkmarks, plus "+ Нова колекція" with an inline name field.

### 5.5 Share Card

Instagram Story (9:16) and square (1:1) images for a Word and for a Correction. Use the edition Decor and a small **SLOVO** watermark, then the iOS share sheet.

### 5.6 Saved (Збережене)

- Three big cards: **Улюблене**, **Колекції**, **Історія**, each with a count and a mini preview.
- Lists: newest first, swipe to remove, tap opens the full card.
- Collections list: create, rename, delete (with confirmation).
- History: "Очистити" with confirmation.
- Empty states use Decor slot 4.

### 5.7 Game (Гра)

- **Mode select:** "Вгадай слово" (definition → word) and "Обери правильне" (sentence with a non-standard form → pick the standard one).
- **Round screen:**
  - top-left ✕ (exit);
  - top-right: **5 lives (hearts)**;
  - to the left of the lives, the rounds passed, shown as **"7 / 15"** and as a progress indicator;
  - centre: a card with the **definition** (or the sentence, in Correction mode);
  - below: **4 answer buttons** (words).
- **Correct answer:** success animation, the button turns green, and a popup shows the example sentence with a "Далі" button.
- **Wrong answer:** the chosen button turns red, the correct one green, a life-lost animation, then "Далі".
- **Exit confirmation popup** ("Вийти з гри? Прогрес буде втрачено").
- **Result screen:** win (all 15 rounds) with Decor slot 6, or loss (0 lives). Rounds, lives left, best result, "Ще раз" / "На головну".
- Sounds and haptics exist; please indicate where feedback happens.

### 5.8 Settings (Налаштування)

1. SLOVO ID / account (hidden in MVP; design it for later: sign in, sign out everywhere, delete account)
2. Theme: System / Light / Dark
3. Font size: S / M / L / XL with a live preview of the word card
4. Notifications: a list of times with add / edit / remove (up to 10)
5. My Mix: categories plus Corrections
6. Hidden entries and categories (restore)
7. Sounds: Sounds / Vibration toggles (Music, with a volume control, comes later; design it)
8. Widgets: how to add (a short illustrated guide)
9. About / feedback

### 5.9 Home-screen widgets

Small and medium sizes, light and dark. Three modes, each rotating every 5 minutes: **Улюблене**, **Колекція** (chosen collection), **Усі слова**. Show the lemma with stress and a short definition (medium only). The widget must use the edition Decor.

### 5.10 Notification

Show how a notification reads: the lemma with stress plus a short definition, plus the custom notification sound (mention it only).

### 5.11 App icon & splash

The **SLOVO** wordmark (Latin script, kept for the UA Edition), an icon in the Ukrainian skin, and the splash (Decor slot 7).

## 6. Sample content (placeholders)

- **ке́бета** (ім., ж. р., розм.): кмітливість, тямущість. _Synonym:_ тяма.
- **веремі́я** (ім., ж. р.): метушня, безлад, сум'яття. _Synonym:_ колотнеча.
- **ошу́я** (присл., заст.): ліворуч. _Antonym:_ одесну́.
- **шпарки́й** (прикм.): швидкий, жвавий.
- Corrections:
  - «приймати участь» → **«брати участь»** (калька);
  - «на протязі року» → **«протягом року»** (росіянізм);
  - «слідуючий» → **«наступний / такий»** (росіянізм).

## 7. Deliverables

1. **Design tokens:** colours (Core neutral plus the Ukrainian skin, light and dark), typography scale (S–XL), spacing, radii, shadows and motion.
2. **Component library:** word card, correction card, action row, chips, buttons, answer buttons (default / correct / wrong / disabled), lives, round progress, sheets, popups, list rows, empty states, tab bar.
3. **All screens from section 5**, with their states, in light and dark.
4. **Decor set** for the Ukrainian skin (7 slots, light and dark).
5. **The Core vs Ukrainian comparison** of the word card.
6. **Motion notes:** feed swipe, heart, correct and wrong answers, life lost, win.

## 8. Out of scope for this design

Monetization and paywalls, Instagram-Stories-specific UI, the in-app word search, lock-screen widgets, user-added words, colour theme presets beyond light/dark, and other Editions' skins (only show that the Core can be re-skinned).

## 9. Design principles: decisions instead of defaults

**Central thesis.** Premium is when someone made a decision. AI slop is a page assembled from defaults: a purple gradient, a centred headline, three cards with emoji, fake logos, made-up numbers. None of it was chosen for the product, so it blends into a million others. If AI writes the code, the only thing that makes the work yours is taste. Therefore: replace every default with a decision.

**A typeface with a job.** Not one neutral font for everything. One with character for headlines, one calm for body text. The typeface must tell the truth about the product: an engineering grotesque for a technical tool, a dramatic serif for a music app about vinyl.

## 10. References

<!-- Add your references here: screenshots, links, mood boards. -->

-
