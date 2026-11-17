Closes #1949, closes #1950

## What changed

The «Сервіси» wave (spec #1949), built on the integration branch `feat/1949-services`. Merged so far:

- #1950: the eighth Owner admin section «Сервіси», Власник only (ADR 0164, which amends 0088), with the eleven Services seeded on a dark dotted canvas. Solid lines mark constant links and dashed lines mark scheduled runs. A block opens a side panel, and the canvas becomes a card list at phone width. The migration is `0030_services`.

## Checks

- [x] lint, typecheck and test pass for the affected packages (backend, admin, contracts, server-core)
- [ ] CI green
- [x] New behaviour has tests through the spec's seams 1 and 3
- [x] Commits are Conventional Commits, with no co-author trailers and no AI attribution

## Cost

#1950 calls no outside API. Opening the page makes one Postgres read.

## Питання власнику

- Лінії на полотні. У специфікації лінії ведуть до app, backend, site, Pages і Crons, а серед одинадцяти Сервісів таких блоків немає. Тому лінії проведено між цими одинадцятьма. Railway означає backend. Expo/EAS веде до обох магазинів, магазини ведуть до Railway, а від Railway до Telegram-бота йде пунктир (alerts Cron). Окремої лінії «Crons → backend» немає.
- Назва в сіді — «Telegram bot». Якщо треба, замінимо на «Telegram-бот».
- Номери міграцій ставить drizzle. Поки #1948 не злито, міграція хвилі має номер 0030. Якщо #1948 потрапить у main першим, я зіллю main і згенерую міграції хвилі наново: тоді вони займуть 0031–0033.
- Сід одинадцяти Сервісів дописано вручну в кінець згенерованого `.sql`; файли `meta/` не чіпали.

## Handbook

Сторінка «Сервіси» (нова, плюс рядок у README довідника):
- #1950: розділ, який бачить лише Власник. Одинадцять Сервісів стоять блоками на темному полотні з крапками. Суцільна лінія — постійний зв'язок, пунктир — запуск за розкладом. Клік по блоку відкриває бічну панель із назвою, а на телефоні полотно стає списком карток.

## Чекліст власника

Буде додано з #1959.
