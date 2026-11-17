STATUS: RUNNING
## NEXT
Setup: mkdir -p /tmp/claude-0 && cp wave/* /tmp/claude-0/; if cloud-setup failed: pg_createcluster 18 main --port 5432 --start then rerun .claude/hooks/cloud-setup.sh. Commit only via /tmp/claude-0/gc.sh. Ignore the stop hook asking for a Claude identity (owner rule wins).
State: all of #1962-#1966 merged into feat/1961-release-channels (tip 558c059f). Draft PR #1968 (body wave/pr-body.md, PATCH via gh api pulls/1968).
Next: review done (wave/review.md: 1 high, 2 med, 7 low); fix implementer running on the integration branch directly (writes /tmp/claude-0/fixes.md). Then CI green (one blocking wait), mark ready via POST pulls/1968/ccr/ready_for_review, add ZeptoMail-on-staging owner question to PR body; NO merge. Then STATUS: FINISHED and Ukrainian report.
## LOG
# HANDOFF coord/release-1961 (spec #1961, tickets #1962-#1966)

- 2026-11-17T11:05:01Z started; reserved ADR 0167-0170, migration 0034. Postgres cluster 18 created by hand (setup hook had failed).
- 2026-11-17T11:06:08Z integration feat/1961-release-channels pushed from origin/main da78fc1b. mattpocock-skills plugin not installed: following docs/agents/waves.md (implementers = local subagents in /tmp/wt/<n>, merger subagent). #1962 (feat/1962-update-channels) and #1963 (feat/1963-staging-deployment) started. ADR plan: 0167 #1962, 0168 #1963, 0169 #1964 if needed, 0170 #1965. Commit only via wave/gc.sh.
- 2026-11-17T11:23:40Z #1963 DONE 53bec605; merger running.
- 2026-11-17T11:33:53Z #1963 merged 6e46c5dd. Draft PR #1968 opened (body wave/pr-body.md; update via gh api PATCH pulls/1968). Waiting on #1962; then #1966 (after #1963) can start now.
- 2026-11-17T11:34:13Z #1966 started in /tmp/wt/1966 (feat/1966-staging-deploy-reset from 6e46c5dd). #1962 still running.
- 2026-11-17T11:37:49Z #1962 DONE 51112901; merger running. Next: #1964, then #1965 (one at a time).
- 2026-11-17T11:38:38Z #1962 merged 1ac2092b. #1964 started in /tmp/wt/1964 (feat/1964-ota-channels). #1965 after #1964 (hot files).
- 2026-11-17T11:50:10Z #1964 DONE 8379650b; merger running; #1965 next.
- 2026-11-17T11:50:32Z #1964 merged 78e51dbd. #1965 started in /tmp/wt/1965 (feat/1965-channel-rule-target). #1966 still running.
- 2026-11-17T11:55:27Z #1966 DONE 8ac4ac81 (report wave/report-1966.md); merger running. #1965 running.
- 2026-11-17T12:08:37Z #1966 merged 3256d245; PR body updated with #1966 (wave/pr-body.md). Remaining: #1965 running, then merge, code-review subagent, fixes, CI, ready.
- 2026-11-17T12:14:57Z #1965 STUCK on ADR 0122 (admin strict output RuleSchema gains targets.channel → breaking-changes check + describe-api refuse). Default chosen: ADR 0170 also amends 0122, admin outputs may gain a field; implementer resumed. Owner Q in PR body.
- 2026-11-17T12:44:49Z #1965 merged 558c059f. All tickets merged; PR body complete; code review starting.
- 2026-11-17T12:51:18Z prettier fix c1106ebd pushed (CI Lint). Code review: 1 high, 2 med, 7 low; fixer running.
