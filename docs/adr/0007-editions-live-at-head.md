# Every Edition builds from the latest Core; per-Edition control comes from switches and update channels

The Core is not versioned or published. Every Edition always builds from the Core on `main`. Each Edition is controlled separately in three ways:

- every behaviour change ships behind a Feature Switch that is turned on per Edition;
- every Edition has its own OTA update channel with staged rollout;
- remote switches on our backend act as an emergency off button.

Native changes still need a store build per Edition.

## Considered Options

- **Versioned Core pinned per Edition**: more explicit, but with one developer and many Editions it means supporting several Core versions at once and backporting fixes. Rejected.
- **Per-Edition branches cut from `main`**: kept as a cheap fallback if Editions ever need to drift.
