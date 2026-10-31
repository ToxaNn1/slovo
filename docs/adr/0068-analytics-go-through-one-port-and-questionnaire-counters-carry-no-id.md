# Analytics go through one port; questionnaire counters carry no reader id

The owner must measure D1/D7/D30 retention and goal completion and learn who the readers are, with no one identifiable. ADR 0060 allowed only anonymous Community Counters and named Analytics among the things to avoid; spec #1358 adds Analytics with the reader's consent.

**One port.** The Core composition gains the port `track(event, properties)` with a typed event union for the 1.0 list: onboarding steps and questionnaire answers, Daily Goal chosen and changed, Game started and finished, the Daily Crossword, Review and Quick Question answers, Daily Goal met, freeze used, Break started, Streak broken, new Level, Badge, notification opened, Share Card shared, Account created, setting changed, screen viewed, Seen, Known and Unknown, Favorites. The Core emits an event where it changes state. The default adapter does nothing. The app shell provides the PostHog adapter: EU host, an anonymous id, no session recording, no tracking prompt, no advertising id, no location, no contacts. The Core imports nothing from PostHog or React Native (ADR 0006).

**One switch.** «Ділитися анонімною статистикою» gates both the adapter and the Community Counters (ADR 0060). Off, nothing is sent and nothing is queued. A Feature Switch of the analytics adapter is required of every Edition and can be turned off remotely only (ADR 0040).

**Questionnaire counters.** A backend endpoint takes anonymous per-answer increments, like Community Counters: no Session, no reader id, no device id, the Edition in the body, no per-reader rows, rate limits. The same answers also travel as properties of the anonymous Analytics id, which links to nothing else.

**The privacy policy** (ADR 0049) changes with this decision: it must name Analytics, the questionnaire counters and the switch. The policy text is prominent copy and waits for the owner's approval of the text; this ADR changes the decision, not the page.

## Considered Options

- **Analytics through an SDK called from screens**: rejected. The Core would miss events, and tests would need the SDK; a port keeps one place and a fake in tests.
- **A device id or the Account id as the analytics id**: rejected. The owner must not tell who a reader is.
- **A separate switch for analytics**: rejected. Privacy is one tap.
- **Session recording and the tracking prompt**: rejected. They add a prompt and data SLOVO does not need.
