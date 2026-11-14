# 0132 Collections follow board 09

Status: accepted (owner, 14.11)

## Context

ADR 0082 gives Category, Curated Collection and Collection one screen style: the 05.1 hero with its kicker, cards with rarity marks, and the Collections list as the k1 grid of three columns. The board 09 (XSaved, screens 75–77) draws Collections otherwise, and the owner chose it (board 09 decisions, 5–11). This ADR amends ADR 0082 for Collections only; Category and Curated Collection keep it.

## Decision

- **The grid.** The Collections tab of «Збережене» is a grid of two columns: a dashed tile «Нова колекція» first, then one card per Collection with its name and «N слів», toned red, ink and sunken by position.
- **A Collection's screen** has a header with back and «⋯», the Collection's name and its count, then its Entries newest first as rows with a chevron, a tap opening the full card, and a wide button «Поділитися посиланням» at the foot while `collectionLinks` is on and the Collection holds an Entry. No hero, no kicker, no rarity marks, no footer line.
- **The menu** («⋯») is a bottom sheet with «Поділитися посиланням», «Перейменувати», «Видалити колекцію» and «Скасувати».
- **New and rename** open one bottom sheet: the field «Назва колекції», a counter «N/40», the Core's refusal shown under the field as the field shakes, and «Створити» or «Зберегти». A new Collection opens at once, empty, with the toast «Колекцію «…» створено.»; a rename ends with «Колекцію перейменовано.».
- **Delete** opens a bottom sheet «Видалити колекцію «…»?» with «Самі записи нікуди не зникнуть.» and «Видалити»; the toast «Колекцію видалено.» then offers «Скасувати» for 3–4 seconds. How the undo brings the Collection back is recorded by the ticket that builds it.
- **Share** opens a bottom sheet: «Колекція така, якою була, коли нею поділилися.», the Collection Link as ADR 0058 makes it (`https://<domain>/<edition>/c/<id>`, by id; the board's link from the name is not used), «Скопіювати посилання», which copies it with `expo-clipboard` and shows «Посилання скопійовано.», and the system Share as before. `expo-clipboard` is a native module and ships in the next EAS batch (ADR 0004); the copy button is behind the Feature Switch `collectionLinkCopy` (needs `collectionLinks`), off until that build is out, and off the sheet keeps the system Share alone.
- **Empty states** use the board's texts; Rupor «чекає» (`waits`) at 140 for «Колекцій ще немає» and «Колекція порожня».
- The board 09 style takes the place of the 05.1 style for Collections behind `collectionBoardStyle`; the next ADR cleanup removes that switch and keeps board 09 alone.
- The texts address the reader with «ти».

## Consequences

- `packages/ui` gains the two-column Collection card grid, the Collection rows and the bottom sheets for menu, name, delete and share; the Collections store keeps create, rename and delete as they are, plus an undo of delete.
- `apps/mobile` adds `expo-clipboard`: an Owner check on the next EAS build.
