# The walkthrough boards override board 10

Status: accepted (owner, 15.11)

## Context

Spec #1909 rebuilds the Profile and the Badges from the walkthrough boards: `SlovoApp` profile, `XSaved` p1–p6 and `XBadges` in `docs/design/export/`. They disagree with the older board «SLOVO 10 Profile» 10.x, which ADR 0085 follows, and with the place of the Profile's name header in ADR 0136. The owner decided (decisions 1, 2, 5, 8, 9, 13, 14, 21, 23 of 15.11) to follow the walkthrough boards.

## Decision

- **The walkthrough boards win.** Where `SlovoApp` profile, `XSaved` p1–p6 or `XBadges` disagree with board 10.x, the walkthrough board is the look in force. The boards draw looks, not features: what they add beyond the owner's decisions is not built.
- **The Profile's order** (amends ADR 0136). The board's blocks come first: the title, the Level card, the Streak, the Active Days calendar, the Badges. The extra blocks follow below the Badges: the name header of ADR 0136, the Level ladder, «Поділитися рівнем», the Streak freeze and Break cards and the progress saving. «Рівень N» appears once.
- **The Badges screen** (amends ADR 0085). The `XBadges` «Родини» overview of the six Badge families heads the screen; below it a card for each of the 21 Badges: the mark at 96, the name, the Badge's short condition and its status, «Отримано» or «Ще ні · N%». The date and the exact progress («23 з 30») show only in the Badge sheet.
- **The stamp** (amends ADR 0085). A tap on an earned Badge with no `badge-opened` record opens the `XBadges` «Штамп» with «ЗАБРАТИ», which writes `badge-opened`; a tap on any other Badge opens the Badge sheet of `XSaved` p3/p4.
- **The family shape everywhere** (amends ADR 0085). A Badge's mark takes its family's shape in the grid, the sheet and the stamp; the circles of p3–p5 are examples only.
- **The shared Button** looks as the boards draw it, on every screen: 62 pt high, 60 pt inside a sheet, its label Unbounded 900 at 15, corners 16, a 5 pt edge.
- **The checker cut.** The `checker` shape (ADR 0087) cuts its top left and bottom right corners at 10% of its side, as the board's tile: `polygon(10% 0, 100% 0, 100% 90%, 90% 100%, 0 100%, 0 10%)`.
- **The Level wedge.** The `wedge` shape of the Рівні family is drawn as the board, its left edge short and its right edge full height: `polygon(0 18%, 100% 0, 100% 100%, 0 82%)`. The toast's wedge keeps its own cut.
- **What stays.** The ADR 0066 Level curve and the Edition's Level names.

## Consequences

- The Button height token rises from 58 to 62 and its label from 16 to 15 across the app; every screen with a Button changes look and is compared with its board in the version's visual pass.
- The Badge shape tokens change (checker cut 20% to 10%, a Level wedge of its own).
- The Edition contract gains a required `conditionText` on every Badge (its short condition, kept in the Edition) and the `badgeFamiliesOverview` Feature Switch, which needs `xpLog` and `badges`; the OpenAPI file and every fixture Edition follow.

## Considered Options

- **Board 10.x stays in force, the walkthrough boards only where it is silent**: rejected. The walkthrough boards are the newer, owner-checked look.
- **The board's Button size on the Profile and Badge screens only**: rejected. Two Button sizes across the app would look like a mistake.
