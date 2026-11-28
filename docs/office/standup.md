# The morning standup

The CEO runs this every day so that the Board is fresh before the owner's 9:00 Telegram report. One run takes 15-20 minutes. It needs a session of its own (`claude --agent ceo`), because only a main session can start the specialists.

## Steps

1. **Decisions.** List `cards` on the Board. Upload any JSON waiting in `~/projects/WORD/office/inbox/`. Done when every card with `status` `approved` or `changes` has a named next step and an agent.
2. **State.** Collect, each through `tail` or `grep`:
   - `git log --oneline --since=yesterday origin/main`;
   - `gh run list -R ToxaNn1/slovo --limit 10`;
   - crash-free users and new issues from Sentry (`SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_APP_PROJECT`);
   - yesterday's installs and active users from PostHog (`POSTHOG_PERSONAL_API_KEY`, `POSTHOG_PROJECT_ID`);
   - follower counts the owner or the SMM agent wrote into `kpi/current`.
     A source that fails is named in the summary as "no data", with the reason.
3. **KPI.** Update `kpi/current`: downloads, followers per network, crash-free users, the plan for the week, `updatedAt`.
4. **Pace.** Compare the week's downloads with the plan. Under 70 % two weeks in a row: ask the Marketer for the card «Вмикаємо бюджет».
5. **Hand-out.** Start the specialists whose work is due today, each with a brief of at most 1.5 KB: the goal, what is ruled out, files by path, the result format. A task over 2 hours becomes a card first.
6. **Cards.** File the cards that today's state calls for. Every open risk to the 15.12 release has one.
7. **Journal.** One entry for the standup, one for each action taken. Then save the day's entries, oldest first, to `~/projects/WORD/office/journal/<YYYY-MM-DD>.md`: the owner's copy outside the Board.
8. **Summary.** Reply in Ukrainian, 10 lines at most: new cards by priority, the three KPIs against the plan, what the team does today, what waits for the owner longest.
9. **Telegram.** Send the owner one line through the Telegram Bot API (`sendMessage` with `TELEGRAM_BOT_TOKEN` to `TELEGRAM_CHAT_ID`), starting «Офіс:»: cards waiting for the owner (P0 count), PRs waiting for his «так», crash-free users. It is the «Офіс» line of the card `ceo-001`; the backend's 09:00 digest stays separate. If the send fails, name it in the summary.

## The schedule

On since 28.11.2026: the owner approved the card `ceo-002`. It is the cloud scheduled task «SLOVO Office: ранкова планірка» (https://claude.ai/code/routines/trig_01UMUK7QTxWTJkZo63Zmrdbc); pause it there to turn it off. It moved to the cloud the same day: a T3 Code scheduled task is skipped, not delayed, when T3 Code is not running at its time, and the first run was lost that way. The T3 Code task of the same name stays paused.

- When: every day at 06:30 UTC, which is 08:30 Europe/Kyiv in winter and 09:30 in summer.
- Where: a cloud session of the environment `slovo`, on a fresh checkout of `main`.
- Model: Opus.
- Prompt: kept in the scheduled task. It tells the run to act as the `ceo` agent, to follow this document, and what a cloud session lacks.

A cloud session has no `~/projects/WORD`; since 28.11 the environment `slovo` holds the Sentry, PostHog and Telegram keys. It skips the inbox upload of step 1 and the Journal copy of step 7, writes everything to the Board, and ends with the summary as the standup's Journal entry. A local run (`Запусти агента ceo: ранкова планірка`) does both skipped steps.
