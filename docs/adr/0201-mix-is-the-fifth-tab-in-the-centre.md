---
summary: «Мій Мікс» is the fifth tab «Мікс» in the centre of the tab bar (Стрічка, Ігри, Мікс, Збережене, Профіль), the screen as the tab's root with no way back, and Settings without «Мій Мікс» and «Рідкість» while the tab is shown (owner, 21.11); no other door from the Feed or the Dashboard; behind the `mixTab` Feature Switch, off giving the four tabs of before as a rollback.
---

# «Мікс» is the fifth tab, in the centre

Owner decision of 2026-11-19, before 1.0.

**Why.** «Мій Мікс» took three taps and a scroll (Профіль, the gear, the «НАВЧАННЯ» group) and the Feed had no way to it, though the Mix decides what the Feed shows.

## Decision

- **Five tabs**, in this order: Стрічка, Ігри, Мікс, Збережене, Профіль (Settings while the Profile is off). «Мікс» sits in the centre; with the Game off, four tabs without «Ігри».
- **The tab opens «Мій Мікс» as its root**, with no back button, the tab bar over it. While the tab is shown, Settings has no «Мій Мікс» row and no «Рідкість» picker: both live on the tab (owner, 21.11). With `mixTab` off they come back to Settings, the row opening the same screen with the way back.
- **No other door.** The Feed and the Dashboard get no extra way to the Mix.
- **«Рідкість»** shows on «Мій Мікс» too (ADR 0156).
- **Switch.** The `mixTab` Feature Switch, `on` in the UA Edition; off, the tab bar is the four tabs of before. The tab bar is JS: no native build.

## Consequences

- VoiceOver counts five tabs («Мікс, вкладка 3 з 5»).
- The first-week card of day 4 points to the tab «Мікс», «унизу посередині».
- The app pass opens `/mix` (ADR 0177).

**Renamed (owner, 21.11).** The tab shows as «Теми» and the screen as «Мої Теми»; the glossary term stays Mix.
