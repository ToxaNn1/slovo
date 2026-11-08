# The «Стрічка» tab opens the Feed

Owner decision of 2026-11-08 (spec #1696 visual pass). The Dashboard is the home behind «Стрічка» and opens the Feed (ADR 0076), so a tap on «Стрічка» on the Feed went back to the Dashboard, while the Feed's wordmark already leads there (ADR 0079). This amends ADR 0076.

**Decision.** While `feedTab` is on (it needs `dashboard`), a tap on the «Стрічка» tab opens the Feed, from the Dashboard or any other tab; on the Feed itself the tap keeps the Feed, which has no re-tap action of its own. The Dashboard stays the home: the app opens on it at launch, Onboarding ends on it and every path that opens the home (ADR 0076), the Feed's wordmark included (ADR 0079), still lands on it. With `feedTab` off the «Стрічка» tab opens the Dashboard as before; with `dashboard` off the Feed is the home and the tab opens it either way.

**Consequences.** The Feature Switch `feedTab`, which depends on `dashboard`, guards the tab's press; the UA Edition has it on. Only the tab's press changes: the home route, the tab bar and its labels stay as they are. While `feedTab` is on, the «Стрічка» button also shows as selected over the Feed, as it does on the Dashboard.
