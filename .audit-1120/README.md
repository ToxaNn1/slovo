# Audit 1120 fix wave (temporary; removed before the batch PR to main)

Verified findings: verified-1-5.md (zones 1-5), verified-6-10.md (zones 6-10). Ids are zone.n.

Owner decisions, 20.11:
- 4.M4: the Action log keeps both the deleted Account's email and its id (add the id). Record this retention in a short ADR (0204).
- 9.L2: «Word History opened» fires when the reader really sees the History, not when the card mounts.
- 10.L5: keep refusing a single Latin letter between Cyrillic words. Do not change it.
- 3.M1: ADR 0089 stands; fix only the low parts that do not contradict it.
