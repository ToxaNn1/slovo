---
summary: Statistics consent — a reader whose phone's region (the one the Rules read, ADR 0089) is in the EEA or unknown is asked in the onboarding with two equal choices, and nothing is sent before they choose; the choice is the one privacy switch; every other reader has it on and is told so; switch `statisticsConsent` (amends 0068). "Who is asked" and the line on readers who finished the onboarding before it are superseded by 0212, which also asks by the phone's time zone.
---

# Statistics consent is asked where the phone's region is in the EEA or unknown

Owner decision of 2026-11-19. ADR 0068 has «Ділитися анонімною статистикою» on for every reader until they turn it off. In the EEA the Analytics and the counters need the reader's yes first, and the privacy policy relies on it. This ADR amends ADR 0068.

**Who is asked** (superseded by ADR 0212, which also asks where the phone's time zone is in the EEA). A reader whose phone's region is in the EEA: the 27 states of the EU, Iceland, Liechtenstein and Norway, and the parts of an EU state that are in the EU under a region code of their own (Åland, the Canary Islands, Ceuta and Melilla, the French overseas regions). The region is the phone's region setting, the one the Feature Switch Rules read (ADR 0089): no IP, no store front. An unknown region counts as the EEA.

**Nothing before the choice.** For a reader to ask, the switch is off until they choose: no Analytics event, no Community Counter, no questionnaire counter leaves the device and none is queued. One function of the Core (`sharesStatistics`) gives the answer every sender asks: the reader's choice, else off for a reader to ask and on for any other.

**The choice is the switch.** The onboarding's second step, after the welcome, offers two equal choices. Either sets the one privacy switch of ADR 0068, which «Конфіденційність» changes later. Not allowing is no switch-off, so it sends no unit of ADR 0163. A reader whose switch holds a choice, from the step or from «Конфіденційність», is never asked again. A reader who leaves the step without a choice keeps the switch off and turns it on in «Конфіденційність»; one who finished the onboarding before this decision is settled once by ADR 0212.

**Everyone else** has the switch on, as before, and the onboarding says so in one line with where to turn it off.

**Own Feature Switch `statisticsConsent`.** Off, no one is asked and the switch is on until turned off, as before this ADR.

## Considered Options

- **Ask every reader**: rejected by the owner. Outside the EEA an honest line is enough and the numbers stay whole.
- **The region from the IP or the store front**: rejected as in ADR 0089; the IP would also be sent before the consent.
- **An unknown region counts as outside**: rejected. A wrong guess sends without consent; the other way only asks once more.
- **A Rule on the `analytics` switch by region**: rejected. A region Rule skips an unknown region, turns Analytics off instead of asking, and leaves the counters on.
- **A separate consent record beside the switch**: rejected. Privacy is one switch (ADR 0135); a kept choice is the consent.
