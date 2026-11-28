---
summary: The Mix is the fifth tab, shown as «Теми», in the centre of the tab bar (Стрічка, Ігри, Теми, Збережене, Профіль), its screen «Мої Теми» as the tab's root with no way back, and Settings without «Мої Теми» and «Рідкість» while the tab is shown (owner, 21.11); no standing door from the Feed or the Dashboard; behind the `mixTab` Feature Switch, off giving the four tabs of before as a rollback.
---

# The Mix is the fifth tab, in the centre

Owner decision of 2026-11-19, before 1.0.

**Why.** The Mix screen took three taps and a scroll (Профіль, the gear, the «НАВЧАННЯ» group) and the Feed had no way to it, though the Mix decides what the Feed shows.

## Decision

- **Five tabs**, in this order: Стрічка, Ігри, Теми, Збережене, Профіль (Settings while the Profile is off). «Теми» sits in the centre; with the Game off, four tabs without «Ігри».
- **The tab opens «Мої Теми» as its root**, with no back button, the tab bar over it. While the tab is shown, Settings has no «Мої Теми» row and no «Рідкість» picker: both live on the tab (owner, 21.11). With `mixTab` off they come back to Settings, the row opening the same screen with the way back.
- **No standing door.** The Feed and the Dashboard get no extra way to the Mix; the Mix review Feed Notice still opens it.
- **«Рідкість»** shows on «Мої Теми» too, at the top, while the tab is shown (ADR 0156); with the tab off Settings shows it.
- **Switch.** The `mixTab` Feature Switch, `on` in the UA Edition; off, the tab bar is the four tabs of before. The tab bar is JS: no native build.

## Consequences

- VoiceOver counts five tabs («Теми, вкладка 3 з 5»).
- The first-week card of day 4 points to the tab «Теми», «унизу посередині».
- The app pass opens `/mix`.
- Renamed by the owner on 21.11: the tab shows as «Теми» and the screen as «Мої Теми»; the glossary term stays Mix.
