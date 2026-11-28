# The morning standup

The CEO runs this every day so that the Board is fresh before the owner's 9:00 Telegram report. One run takes 15-20 minutes. It needs a session of its own (`claude --agent ceo`), because only a main session can start the specialists.

## Steps

1. **Decisions.** List `cards` on the Board. Upload any JSON waiting in `~/Downloads/WORD/office/inbox/`. Done when every card with `status` `approved` or `changes` has a named next step and an agent.
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
7. **Journal.** One entry for the standup, one for each action taken. Then save the day's entries, oldest first, to `~/Downloads/WORD/office/journal/<YYYY-MM-DD>.md`: the owner's copy outside the Board.
8. **Summary.** Reply in Ukrainian, 10 lines at most: new cards by priority, the three KPIs against the plan, what the team does today, what waits for the owner longest.

## The schedule

On since 28.11.2026: the owner approved the card `ceo-002`. It is the T3 Code scheduled task «Ранкова планірка»; pause or delete it there to turn it off.

- When: every day at 08:30 Europe/Kyiv.
- Where: a new T3 Code thread in the SLOVO project, named `Ранкова планірка, <DD.MM>`.
- Model: Opus.
- Prompt: `Run the morning standup: follow docs/office/standup.md step by step as the ceo agent. Reply in Ukrainian.`
