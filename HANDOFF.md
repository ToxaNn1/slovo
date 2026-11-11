STATUS: ACTIVE

# Wave cleanup-1111: code health after the Core audit

Coordinator: cloud session. Base: origin/feat/1764-media-store (main + #1792 media code).
Integration branch: chore/<spec#>-core-cleanup (from the base). One PR to main only after #1792 merges
(then `git merge origin/main`, no rebase). NO merge to main, NO auto-merge, NO force-push. ADRs 0106-0108 only.

Tickets (spec "Code health after the Core audit"):
- W1: T1 crossword test <1 s + fast-check grid properties; T2 Mix keys from EntryKind, Entry kinds in one place;
  T3 "time ran out = win" in one place; T4 XP Log `mode` typed union, parsed at the storage edge;
  T5 Feature Switch lint rule sees switches stored in variables; T6 no React Compiler rule disables in apps/mobile;
  T7 widget link replaces the open Word (no native code).
- W2: T8 shared code for the two crossword hooks (after T3); T9 commitlint: keep only the noreply address (after #1792).

Hard rules: plain `git commit`; never a command with the owner's email; no `&`/`nohup`; no AI attribution;
commitlint types/scopes; never touch feat/1108-video, apps/video, backend media code, feat/1764-media-store itself; no EAS.

## Log
- 2026-11-11T21:18:30Z step 0: coord branch created
- 2026-11-11T21:23:51Z spec #1800, tickets #1801 #1802 #1803 #1804 #1805 #1806(after 1803) #1807(after #1792); integration chore/1800-core-cleanup pushed (PLAN). T6/T7 dropped: already on main. Push identity: noreply via scratchpad id.sh (env gmail is refused by GitHub).
- 2026-11-11T21:24:41Z W1 started as local worktree subagents: #1801 (Opus), #1803 (Fable), #1804 (Fable), #1805 (Opus). Next: #1802 after #1803 (core barrel), #1806 after #1803, #1807 after #1792.
- 2026-11-11T21:25:32Z #1804 STUCK: closed union of Game Mode ids conflicts with ADR 0006 (Game Mode is an Extension Point, Edition modes). Default taken: no code change, keep mode: string; PR «Questions for the owner»: option branded GameModeId parsed in progress/records.ts:44,100 or ADR change. Do not relaunch #1804.
- 2026-11-11T21:30:43Z #1803 merged (8a11d49c, author reset to noreply on merge). Worktree agents start from origin/main: brief them to branch from chore/1800-core-cleanup. Launching #1802, #1806.
