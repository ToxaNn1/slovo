# A Service opens in a wide window

Owner decision of 2026-11-17, after the first look at «Сервіси» in production. This ADR amends ADR 0164 (a block opens a side panel) and builds on ADR 0160 (the native modal `<dialog>`).

**A block opens a wide window, not a side panel.** The side panel was narrow: the owner scrolled it to find a Service's money, usage and entries one under another, and part of the usage came as raw JSON. A click on a block now opens the same native modal `<dialog>` (Esc and the back gesture close it, focus stays inside, the page behind does not scroll) as a wide window in the middle of the screen, up to 1180 px wide and the window's height less 2 rem.

**Three columns side by side.** «Гроші» (plan, price, billing day, this month's spend, the currency), «Використання» (every limit as a bar with «X з Y», what is left and one plain line on what it counts; a Cron's last and next run; the provider's plan limits) and «Записи» (the Service's entries, the add form behind «Додати запис»). On a 1280 × 800 screen all three fit without a scroll; below the `lg` width they stack and the window scrolls inside itself.

**Plain words only.** Nothing in the window is raw JSON or a field name: amounts carry their units (МБ, ГБ, CU-год, $), times read «17 листопада, 19:40», and a limit at 90 % or more turns the bar and its share yellow.

**Railway's spend is shown by part.** The Railway reading gains `spendParts`, this month's USD of each part Railway bills (`cpu`, `memory`, `egress`, `disk`, `RailwaySpendPartSchema`), read from the same usage query; «Гроші» lists them as «Процесор», «Пам'ять», «Вихідний трафік», «Диск» under the month's total.

**It moves, unless the reader asks it not to.** The window fades and grows in over a fading scrim, its columns rise one after another and the bars fill from the left; under `prefers-reduced-motion: reduce` none of it animates.
