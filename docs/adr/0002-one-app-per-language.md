# One app per language, not one app with a language switch

Each language ships as its own Edition: a separate App Store app with its own bundle id, name and store listing, all built from a shared Core. An Edition's UI language and content language are the same. This keeps each app focused for its audience and its store search, and lets every Edition grow on its own schedule. The cost is that the Core has to be a real reusable product rather than code inside one app.

## Consequences

**App Store risk:** this sits close to App Store Review Guideline 4.3(a), "Don't create multiple Bundle IDs of the same app". The risk starts with the second Edition.

**Mitigation:** every Edition must be genuinely distinct:

- a name in its own language;
- its own Decor and design tokens;
- its own content;
- a store listing in its own language.

**Fallback:** if an Edition is rejected under 4.3, we ship a single SLOVO app that loads Editions as downloadable language packs. Because an Edition is only configuration and assets, this fallback is a packaging change, not a rewrite. Separate developer accounts per Edition are explicitly ruled out.
