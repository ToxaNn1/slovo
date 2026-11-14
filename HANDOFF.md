# Wave #1861 (board 11 Settings) — coordinator #1 handoff (rewrite whole, never append)
Owner ran /mattpocock-skills:implement-spec on #1861. Follow that SKILL.md + docs/agents/waves.md «Steps» + docs/agents/ticket-brief.md. Grant: ~/.slovo-coord/grant-settings-1861.md (no main merge, no force-push, no branch deletion, no EAS).

## State (14.11 ~20:45Z)
- main = 44e4f260f. Nothing built yet. Integration branch feat/1861-settings-board NOT created yet: create from origin/main, push.
- Spec #1861; tickets #1862–#1878 (sub-issues, native blocked-by). Owner decisions: ~/Downloads/WORD/plans/board11-owner-decisions.md. Differences D1–D49: ~/Downloads/WORD/plans/board11-differences.md.
- Graph: #1862 (ADRs 0133–0136, glossary, strings, switches; LAPTOP, first). After it: #1863 handbook (laptop: handbook lives in ~/Downloads/WORD/handbook/), #1864, #1865, #1866–#1873 parallel. After #1864: #1874, #1875, #1876. #1877 after #1864 #1865 #1874. #1878 blocked on Recordings «заграва» — skip until owner says.
- Shared files: #1864 owns the Settings list/row primitive; #1874–#1876 each touch one row → merge in order, expect small conflicts.
- Reports dir: ~/.slovo-coord/settings-1861/wave/reports/.

## Next steps
1. Register the wave in origin/coord/safety-net:WAVES.md (block `## wave settings-1861`, status active, coord coord/settings-1861) and a line in ~/.slovo-coord/watchdog/threads.md with your thread id. Create coord/settings-1861 with HANDOFF.md (plumbing push; zsh "${c}:refs/heads/...").
2. #1862 on the laptop via an Opus implementer subagent (tdd, own worktree on the integration branch); merge with a merger subagent; open draft PR «feat: board 11 Settings» with Closes lines after the first merge.
3. Then the frontier in cloud implementers (briefs ≤1.5 KB, pointers only; rules ~/.claude/projects/-Users-mykhailo-projects-SLOVO/memory/cloud-context-rules.md, never the owner's email).
4. All merged → code-review → one fixer → handbook check → PR ready; main merge only on owner word.

## Rules learned (wave 09)
- Cloud implementers push in one batch; a quiet branch is not stuck. Big tickets hit 180k: narrow successor briefs.
- Watchdog «RED» may be stale: check `gh pr checks`. Add handled STUCK/DONE shas to ~/.slovo-coord/watchdog/handled.
- Metro 8082 is the one Metro; reuse, never a second. Owner tests on his phone; give a check list.
- Thread titles: yours «🟢 🧭 Координатор · дошка 11»; predecessor «💤 старий · …».
