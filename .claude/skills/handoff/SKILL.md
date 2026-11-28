---
name: handoff
description: Hand a session off near the context limit (or when the owner asks) - write the ≤ 2 KB handoff, open the fresh chat pointed at it, rename both chats. Use at the token-budget soft limit, between tasks, never mid-task.
---

# Handoff

The rules come from `CLAUDE.md` (Token economy) and `.claude/hooks/token-budget.mjs`; this skill is their one sequence.

1. Finish or park the current step. Leave work on its branch; commit only if the owner already said so in this conversation.
2. Write the handoff, rewritten whole, at most 2 KB, current state only (no history):
   - locally `~/.slovo-coord/handoff-<YYYY-MM-DD>-<topic>.md`, in the cloud `/tmp/handoff.md` (the path must contain `handoff`: the hard limit lets only that file through);
   - sections: **Goal** · **Done** (PR and issue links, branch, last SHA) · **Open** (what and its state) · **Next** (1-3 steps) · **Owner's permissions** (verbatim, with what each covers) · **Mode** (fast or heavy).
3. Check the size: `wc -c <file>` ≤ 2048. Cut words, not facts.
4. In T3 Code: open the new chat yourself with `t3_thread_launch`, prompt «Продовж з handoff: <absolute path>. Спершу прочитай його.» Give it the SAME icon and name as this chat (icon + short topic, e.g. «🧭 Координатор»). Rename this chat to «✅ <name> — закрити» with `t3_thread_update`. Outside T3 Code (cloud), print the handoff as the final message.
5. Tell the owner in one Ukrainian line, with the new chat's link. End the turn. Never `/compact`.
