STATUS: RUNNING
## NEXT
Frontier #1962 #1963; then #1964, #1965 one at a time; #1966 after #1963. #1967 untouched.
## LOG
# HANDOFF coord/release-1961 (spec #1961, tickets #1962-#1966)

- 2026-11-17T11:05:01Z started; reserved ADR 0167-0170, migration 0034. Postgres cluster 18 created by hand (setup hook had failed).
- 2026-11-17T11:06:08Z integration feat/1961-release-channels pushed from origin/main da78fc1b. mattpocock-skills plugin not installed: following docs/agents/waves.md (implementers = local subagents in /tmp/wt/<n>, merger subagent). #1962 (feat/1962-update-channels) and #1963 (feat/1963-staging-deployment) started. ADR plan: 0167 #1962, 0168 #1963, 0169 #1964 if needed, 0170 #1965. Commit only via wave/gc.sh.
