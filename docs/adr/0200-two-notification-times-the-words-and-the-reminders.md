---
summary: Notifications have exactly two Notification times under one switch «Сповіщення»: «Слово» (the Word of the Day, default 09:00) and «Нагадування» (the evening notification, default 19:00), the Reminder always after the Word; no time is added or removed; off stores an empty list and on brings back the Edition's defaults; a stored list reads as the Word at its first time and the Reminder at its last, so lists kept before stay valid; the onboarding's time becomes the Word's, with the default Reminder when it comes later.
---

# Two Notification times: the Word's and the Reminder's

Owner decision of 2026-11-19 (audit D-10, ticket #2065).

**Why.** Settings › Сповіщення let the reader keep up to 10 times, yet since 1.0 at most two notifications come a day: the Word of the Day at the earliest time and one evening notification at the latest. The times in between did nothing, and the Settings row named times that never rang.

## Decision

- The reader has two Notification times: **«Слово»**, when the Word of the Day comes, and **«Нагадування»**, when the evening notification (the Streak warning or «Ціль ще не виконана») comes. The Edition declares them as its default list, first the Word's, last the Reminder's (UA 09:00 and 19:00).
- One switch **«Сповіщення»** on top of the screen: on, both times are active; off, none is, and the two rows hide. Switching on again starts from the Edition's defaults. No time is added or removed.
- The Reminder always comes after the Word: a Word time at or after the Reminder's, or a Reminder time at or before the Word's, is refused, and a one-line hint says so.
- Storage stays the list of times: off is the empty list, on is `[word, reminder]`. A list kept before this ADR (up to 10 times) reads as the Word at its first time and the Reminder at its last, which is what the plan already did; one stored time is the Word with no Reminder until the reader sets one.
- The onboarding's «Коли нагадати?» sets the Word's time; the Reminder is the Edition's default when that comes later, and none otherwise. «Без нагадувань» switches notifications off.
- The Settings row reads «09:00, 19:00» (the Word's alone with no Reminder), or «Вимкнено» while off or while iOS does not allow notifications.

## Consequences

- The strings for adding, removing and counting times go; `notifications.word`, `notifications.reminder` and `notifications.orderHint` come.
- The plan (`notification-plan.ts`) is unchanged: it still takes the first and the last time.
