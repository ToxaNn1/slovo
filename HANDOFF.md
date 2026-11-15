# Profile walkthrough wave #1909 — coordinator handoff
Coordinator: laptop T3 thread mcp:launch:8e92051c («🟢 🧭 Координатор · Профіль і відзнаки #1909»), from 15.11 ~15:50Z.
Grant (GRANT.md): commits, pushes, ONE integration branch feat/1909-profile-walkthrough, one draft PR to main. NOT: merge to main (owner's word only), force-push, branch deletion, EAS.
Scheme: mattpocock-skills:implement-spec + docs/agents/waves.md. Cloud implementers via `claude --cloud` with BRIEF-CLOUD.txt (NUM/BRANCH/LANE/ADRS); #1921 local (visual pass, Metro 8082).
Reserved: ADR 0145–0147 (main took 0144 via #1922; 0145 = #1910, merged). No migrations.
Hot files one at a time: edition.json, contracts edition schema, CONTEXT.md, ADR index. strings.json: own keys only (games precedent).
Graph: 1910,1912 → 1911(1910) 1913(1910) 1915(1910) 1919(1910) → 1914(1912,1913) 1916(1915) 1917(1913) 1920(1911) → 1918(1917) → 1921(1911,1912,1914,1916,1918,1919,1920).
Inputs: reports/ (owner decisions 1–24 + comparison reports), HANDBOOK-profil.md (owner's handbook page copy).
Never end your turn while work remains; push a `WAITING until <UTC>` line here before any wait >10 min. At the very end: `STATUS: FINISHED` first line.
## State
- feat/1909-profile-walkthrough 0ca3056ce: origin/main 1468a3269, #1910, #1912 merged. Draft PR #1923.
- 16:14–16:20Z DONE #1911 #1915 #1919, STUCK #1913 (ui done; two app tests in badges-screen.test.tsx expected old symbol/checker): one merger merges all four (authors fixed, local tips 578849d2 5293321 221e1d5f cef23e80) and fixes those two tests.
- Next after that merge: launch #1914 #1916 #1917 #1920 (briefs ready on the laptop), then #1918 (1917), then #1921 (local).
- Cloud merge commits came with a foreign email: replay with ~/.slovo-coord/profile-1909/fix-authors.sh <integration> <ticket tip> (commit-tree, same trees; no force-push), merge the printed tip.
- Handbook page профіль-і-бейджі: updated in #1921 from all merged reports (copy HANDBOOK-profil.md).
## Log
- 15.11 ~16:05Z wave started; #1910 #1912 launched in the cloud.
- 15.11 ~16:35Z #1910 merged (ADR renumbered 0145), PR #1923 draft; launched #1911 #1913 #1915 #1919.
- 15.11 ~16:25Z #1912 merged 0ca3056ce (checks green). ~16:35Z merger on #1911 #1913 #1915 #1919.
