---
summary: A new reader whose phone region is in the EEA (EU, Iceland, Liechtenstein, Norway), or names no country, starts with «Ділитися анонімною статистикою» off and is asked on an onboarding step with two equal choices; everywhere else the switch starts on and the welcome says so in one line; settled once per install; switch `statisticsConsent` (amends 0068).
---

# Readers in the EEA are asked before statistics are sent

Owner decision of 2026-11-19. ADR 0068 puts Analytics and the Community Counters behind one privacy switch, «Ділитися анонімною статистикою», which starts on for every reader. The privacy-policy draft relies on consent where the law asks for it. This ADR amends ADR 0068: where the switch starts depends on the phone's region.

**The region** is the phone's two-letter region, read the way the Rules of the Feature Switches read it (ADR 0089). The Statistics consent is needed in the EEA: the 27 countries of the EU, Iceland, Liechtenstein and Norway. A region that names no country (none, or a code that is not two letters) counts as the EEA.

**A reader who needs it** starts with the switch written off and the consent pending, before any module reads the switch, so nothing is sent: no Analytics event, no Community Counter, no questionnaire counter, no switch-off unit (ADR 0163). The onboarding asks on a step right after the welcome, with two equal choices, allow or don't allow, neither drawn as the main one. The answer sets the switch and ends the question for good. Going on without an answer or skipping the onboarding leaves the switch off; an onboarding left unfinished asks again on the next launch. The choice changes later on «Конфіденційність», as before.

**Every other reader** starts with the switch on, as before, and sees no step. The welcome says in one line that anonymous statistics are on and where to turn them off.

**Settled once per install**, at the first launch, and kept in the user state: a later change of the phone's region changes nothing. A reader whose switch is already written, and a reader who finished the onboarding before this rule, is not asked and stays as they were.

Consequences:

- The Core composition takes a reader of the region; without one, as in tools and tests, no one is asked. The app shell passes the same reading the Rules get.
- A device-only record keeps that the consent is pending; the switch itself stays the one record of ADR 0068.
- Own Feature Switch `statisticsConsent`; off, every reader starts with the switch on and no one is asked or told, as before this ADR.
- The privacy policy names the rule; its text waits for the owner's approval (ADR 0068).

## Considered Options

- **Ask every reader**: rejected by the owner. Consent is asked only where the region calls for it; the rest are told honestly.
- **Work out the region at each event**: rejected. A reader who travels would flip between on and off without being asked or told.
- **The region from the IP address or the SIM**: rejected. It needs a network call or a permission before the first screen; the phone's region is what the Rules already read.
- **An unknown region counts as outside the EEA**: rejected. Sending without consent is the worse mistake.
- **Ask readers who finished the onboarding before the rule**: not now. The onboarding never opens again for them, so asking them needs a surface of its own and the owner's decision.
