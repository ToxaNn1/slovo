# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues in `ToxaNn1/slovo`. Use the `gh` CLI for all operations; it infers the repo from `git remote -v`.

## Issue shape

Every ticket and spec body uses the STAR form from `CLAUDE.md` ("Tickets"), in this order:

```markdown
## Parent

#<parent>

## Situation

## Task

## Action

## Result

- [ ] <checklist item>

## Blocked by

#<n>, #<n> (or "nothing")
```

The `## Blocked by` section is the canonical blocking record: it can name a human blocker too ("the owner's first build"). Labels and milestones follow `CLAUDE.md`.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body-file <file>` (write the body to a file first).
- **Read an issue**: `gh issue view <number> --json number,title,body,labels,comments`.
- **List issues**: `gh issue list --state open --json number,title,labels` with `--label`, `--milestone` and `--search "parent:<n>"` filters. Pull bodies one issue at a time, not in the list.
- **Make an issue a sub-issue of a parent**: `gh issue create --parent <parent> ...`, or `gh issue edit <parent> --add-sub-issue <child>` afterwards. Keep the `## Parent` line in the body as well.
- **Blocking**: write the blockers in `## Blocked by`. When a blocker is an issue, also add GitHub's native dependency so the UI shows it: `gh api --method POST repos/ToxaNn1/slovo/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, where `<blocker-db-id>` is `gh api repos/ToxaNn1/slovo/issues/<n> --jq .id` (not the `#number`). A ticket is unblocked when every blocker in `## Blocked by` is closed or done.
- **Comment on an issue**: `gh issue comment <number> --body-file <file>`.
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`. Create a missing label first with `gh label create`.
- **Close**: `gh issue close <number> --comment "..."`.

## Pull requests as a triage surface

**PRs as a request surface: no.** This repo has no triage flow; `/triage` is not configured.

## When a skill says "publish to the issue tracker"

Create a GitHub issue in the STAR form above, as a sub-issue of its parent spec.

## When a skill says "fetch the relevant ticket"

Read it as in **Read an issue** above.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. `gh issue create --label wayfinder:map`.
- **Child ticket**: a sub-issue of the map (see **Make an issue a sub-issue of a parent**), labelled `wayfinder:<type>` (`research` / `prototype` / `grilling` / `task`). Once claimed, it is assigned to the driving dev.
- **Blocking**: as in **Blocking** above.
- **Frontier query**: list the map's open children (`gh issue list --state open --search "parent:<map>"`), drop any with an open blocker or an assignee; first in map order wins.
- **Claim**: `gh issue edit <n> --add-assignee @me`, the session's first write.
- **Resolve**: `gh issue comment <n> --body "<answer>"`, then `gh issue close <n>`, then append a context pointer (gist + link) to the map's Decisions-so-far.
