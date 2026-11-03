# Spec waves

How the coordinator builds a spec. The owner's scheme since 2026-11-03: `/mattpocock-skills:implement-spec`, with the SLOVO rules below. Implementers follow [ticket-brief.md](ticket-brief.md).

## Shape

- One **integration branch** per spec, `<type>/<spec-number>-<slug>`, cut from `origin/main` and checked out in the main repo folder. Ticket branches `<type>/<n>-<slug>` stay local, one worktree each.
- The spec reaches `main` as ONE PR: CI runs on it, the review runs once, auto-merge squashes it on green.
- No cloud sessions, wave runner, heartbeat commits or watchers. A background subagent's end reaches the coordinator as a notification; nothing is polled.

## Steps

1. Work only on the tickets the owner's grant names.
2. Create the integration branch and push it.
3. **Implementers:** one background subagent per ticket on the frontier (blockers merged into the integration branch), `isolation: "worktree"`, model per `CLAUDE.md`, at most 5 at once, never two at once on the same hot file (Edition strings, `edition.json`, `CONTEXT.md`, the ADR index, barrels). Brief ≤ 1.5 KB of pointers: ticket number, ticket branch, integration branch, the Testing Decisions, verification, grant, «follow `docs/agents/ticket-brief.md`».
4. **On each report**, act in the same turn:
   - `DONE #n`: merge the ticket branch into the integration branch (`git merge --no-ff`), run the changed packages' checks, push. After the first merge open a draft PR against `main` (`Closes` the spec and its tickets).
   - `FAILED`, `STUCK`, or a report without that first line: relaunch from its handoff on the same branch, split the ticket, or ask the owner (serious matters only). Never leave it for later.
   - Start every ticket the merge put on the frontier.
5. **End:** `code-review` on the integration branch; one implementer fixes the findings. PR body: Checks, «Questions for the owner», «Owner checks», new reader-visible texts. Mark it ready and `gh pr merge --auto --squash`, unless prominent copy waits for «текст ок». Red CI: one implementer fixes it.
6. Remove the implementer worktrees.

## Unchanged

Grants, the token budget, Feature Switches, «текст ок», one visual pass per version, the machine-load limit, no EAS build without the owner's word, the owner's authorship and no AI attribution.
