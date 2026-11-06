# The Feed's wordmark opens the Dashboard

Owner test pass of 2026-11-05 (spec #1578). The Dashboard is the home behind «Стрічка» and opens the Feed (ADR 0076), but the Feed's header gave no way back to it but the tab bar. This amends ADR 0076.

**Decision.** While `dashboardWordmark` is on (it needs `dashboard`), the wordmark in the Feed's header is a button that opens the Dashboard. VoiceOver reads it by the Edition string `dashboard.open` («SLOVO, на головну») as a button, in the Edition's language. With `dashboard` off the Feed is the home and its wordmark stays the screen's header, with no action. The Dashboard's own header keeps its wordmark on the ink plate as a header.

**Consequences.** The Feature Switch `dashboardWordmark`, which depends on `dashboard`, guards the button; the UA Edition has it on. The tap goes through the app's one-tap screen opener, as every other tap that opens a screen.
