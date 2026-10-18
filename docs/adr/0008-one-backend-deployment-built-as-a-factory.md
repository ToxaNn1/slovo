# One backend deployment, built as a factory

All Editions share one backend deployment and one Postgres database, with data partitioned by Edition. That is what lets one Account (SLOVO ID) work across Editions with a single deployment, migration and bill. Inside, the backend follows the same rules as the app (ADR 0006): a server Core, server-side Extension Points for Edition-specific logic, and per-Edition Feature Switches stored in the database. Because every deployment runs the same code, an Edition that ever needs isolation can get its own copy of the server without a rewrite.

## Considered Options

- **A separate backend and database per Edition**: rejected. It multiplies operations and cost, and it breaks a shared SLOVO ID unless a central auth service is added on top.

## Amendment: the backend reads Feature Switches from the Edition config (ADR 0030)

Until remote Feature Switches arrive with sync (0.8), the backend reads an Edition's switches from its `edition.json`, as the app does, not from the database. ADR 0030 says how the server Core, the shell and the Edition folders make the factory.

## Amendment: remote Feature Switches only turn features off (0.8, ADR 0040)

From 0.8 the database also holds remote Feature Switches. They can only turn a feature off: the Edition config still decides what an Edition offers, and a remote switch takes a feature away in an emergency, without a build. ADR 0040 says how they are stored, set and served.
