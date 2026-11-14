# Domain docs

How the engineering skills consume this repo's domain documentation. Single-context repo.

## Where they live

- **`CONTEXT.md`** at the repo root is the glossary. Wherever a skill says `GLOSSARY.md`, read `CONTEXT.md`. Do not create a `GLOSSARY.md` or a `GLOSSARY-MAP.md`.
- **`docs/adr/`** holds the decisions; `docs/adr/README.md` indexes every ADR in one line each.

## How to read them

`CONTEXT.md` is over 50 KB. Never read it whole: `grep -n` it for the terms your change names and read those entries. Read `docs/adr/README.md` first, then only the ADRs that touch your area.

## Use the glossary's vocabulary

When your output names a domain concept (an issue title, a refactor proposal, a hypothesis, a test name), use the term as `CONTEXT.md` defines it, and avoid the words each term lists under _Avoid_.

If the concept is not in the glossary yet, either you are inventing language the project does not use (reconsider) or there is a real gap: `/domain-modeling` adds the term to `CONTEXT.md`.

## Flag ADR conflicts

`CONTEXT.md` and the ADRs override tickets and specs. If your output contradicts an ADR, stop and report it to the owner rather than overriding it:

> _Contradicts ADR 0007 (…), but worth reopening because…_

## An ADR that blocks

An ADR that blocks sensible work (the code or a later decision has moved on, or following it costs far more than it saves) is never worked around and never followed in silence. Stop and propose to the owner a short superseding ADR: what the old one says, what blocks, what the new one would say. Only the owner's yes makes it a decision; until then the old ADR holds.

## ADR cleanup at the end of a version

The last PR of a version (milestone) is followed by one docs PR that sweeps `docs/adr/`: every ADR the version made untrue is marked superseded or amended in its file and in its `docs/adr/README.md` line, and every ADR that blocks goes to the owner as a proposal, as above.

A new decision is recorded as an ADR in the same change, with a line in `docs/adr/README.md`.
