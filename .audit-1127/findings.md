# App pass 2026-11-27 — findings for the cloud fix wave

Pass: iPhone 18 Pro simulator (iOS 27.2), Expo Go, production JS (`expo start --no-dev --minify`), live API. Every step was screen-recorded; stalls were measured from frame timestamps (gaps between frames inside continuous motion). Simulator on a loaded Mac: the stall lengths are indicative, the places are what matters. The code causes, with file:line and fixes, are in `code-jank-audit.md` next to this file (H1–H2, M1–M9, L1–L8).

## A. Animation stalls (wave A)

| # | Where | What the owner sees | Measured | Code cause |
|---|-------|--------------------|----------|-----------|
| A1 | Switching tabs | ~1 s pause mid-transition | 940–960 ms on 3 of 6 taps | M8 |
| A2 | Feed, swipe up | the card sticks mid-flight on every swipe | 620–790 ms per swipe | H2, M9 |
| A3 | Correction type screen (Суржик), scrolling the card list | stutter while scrolling | 58 stalls, up to 1.2 s | not in the audit: find it (card render during scroll) |
| A4 | Category screen (Людина і тіло), scrolling words | stutter | 25 stalls, up to 240 ms | M2 |
| A5 | Card «Більше дій» sheet | opens with a pause | 800 ms | M7 |
| A6 | Saved › Слова дня entry push | pause | 1.2 s | M1 |
| A7 | Crossword | trace and letters lag the finger | not measured | H1 |
| A8 | Timed game | timer bar jitters | — | M6 |
| A9 | Goal-reached card, Weekly Recap fold | height animated per frame | — | M4, M5 |
| A10 | Onboarding, every step | the Mascot idles in a loop; the screen redraws at 60 fps with no input | 60 fps idle | L4 |

Then L1–L8 where cheap.

## B. Layout, text and behaviour bugs (wave B)

Onboarding
- B1. Level result card: the title breaks inside a word, «Рідкість лишаєтьс / я від 1 до 5», and overlaps the big «5».
- B2. The big headlines «ГРАЙ!» and «ДЗИНЬ!» run into «Пропустити» at the top.
- B3. Level quiz: two progress bars stacked with no gap (onboarding steps + «1 з 10»); read as one broken bar.
- B4. First Word card: the definition is cut mid-phrase («…щоб поширювати») with no ellipsis before «Детальніше».
- B5. «Інший час» opens the picker on the current time (20:35), not on the Edition's default reminder time.

Feed
- B6. Swipe right («знаю») leaves the same card with «Позначено: знаю»; swipe left moves on. Check against the ADRs/glossary: fix if it is a bug, report if it is a rule.
- B7. The «Позначено: …» toast is narrower than the card and covers its tabs; the card's red shadow shows to its right.

Categories and corrections
- B8. Category feed card header «КАТЕГОРІЯ · ЛЮДИНА І ТІЛО · 1 з 442» wraps into 3 lines under the action buttons and splits «1» from «з 442» (use a non-breaking space, keep it off the buttons).
- B9. Мої Теми: the «ПИТАННЯ» tile truncates its value to «Помір…».

Profile and settings
- B10. Profile: «1 XP · Початківець · 1 / 50 XP · ще 49 XP до рівня 1» — «до рівня 1» next to a named level reads as a contradiction; check the level model and show the next level correctly.
- B11. «Про SLOVO» shows «Версія 0.9»; find where it comes from and make it the real app version.
- B12. Rarity re-test (Settings › Перевірити рівень ще раз): «куліш» without a stress mark while the onboarding test shows stress; large empty space above the question.

Games
- B13. «Вгадай слово», a wrong answer: the banner says «МИМО. Майже. Ось як правильно…»; «Майже» is wrong for a plain miss. Propose the string in the report, do not invent copy beyond that line.

Other
- B14. `c/<linkId>` for a missing link: a bare «Цього посилання більше немає.» with no way out; add the back/home action the other empty states use.

## C. Maestro (wave B, after B1–B14)
- C1. `apps/mobile/maestro/app-pass.yaml` is behind the app: the Feed's first-open coach «Гортай пальцем» («ЗРОЗУМІЛО»), the Correction grid is now `correction-types` when `correctionTypeGrid` is on, Collection steps need a Collection. 18 of ~60 steps fail.
- C2. `flows/onboarding.yaml` and `fresh-onboarding.yaml` describe the old 5-step onboarding; the onboarding is now welcome → first word → voice → «Грай» → level (with the 10-word test) → «Навіщо» → goal → reminder.
- C3. `scripts/app-pass.mjs` looks for Java only in `/usr/local/opt/openjdk@17`; also try `/opt/homebrew/opt/openjdk@17` (Apple silicon Homebrew).
- C4. `app-pass/open.yaml` taps the link prompt «Open» only; a simulator in Ukrainian shows «Відкрити».

## Not for this wave
- Content: the 4 Curated Collections «ТЕСТ 1–4 … Не для релізу» are live in production. Owner decision; do not touch the content database.
- «Sign in with Apple» renders in English in Expo Go; check on the TestFlight build (owner check).
- Anonymous statistics on by default: issue #2082.
