# The SLOVO Office

The Office is a team of seven AI agents that grows SLOVO the way a mid-size company would. The owner decides; the agents prepare, do the internal work and report.

## Goals

By 28.02.2027:

1. At least 2 000 followers in one social network (TikTok is the main one, Instagram the reserve).
2. At least 10 000 App Store downloads. Checkpoint: 5 000 by 15.01.2027, about 1 100 a week.
3. Crash-free users at or above 99.5 % in Sentry.

The App Store release is 15.12.2026. Growth is organic first. A $200 a month reserve exists: when downloads stay under 70 % of the plan two weeks in a row, the Marketer files the card «Вмикаємо бюджет» with the channel, the forecast and the check. The owner decides.

## The team

| Agent file   | Card `agent` | Owns                                                                 |
| ------------ | ------------ | -------------------------------------------------------------------- |
| `ceo`        | `ceo`        | The master plan, the morning standup, task hand-out, the three KPIs  |
| `cto`        | `cto`        | Stability, bugs, dependencies, staging, release, docs matching code  |
| `seo`        | `seo`        | The App Store page, the landing's SEO, search inside social networks |
| `marketer`   | `marketing`  | Growth strategy, positioning, the launch, partners, the budget rule  |
| `copywriter` | `copy`       | Posts, captions, video scripts, store copy, in-app strings           |
| `smm`        | `smm`        | Five networks: Instagram, Threads, TikTok, YouTube Shorts, Telegram  |
| `security`   | `security`   | App and backend security, secrets, privacy, legal pages, account 2FA |

The CEO owns "what and why", the CTO "how, and does it break the app". The Marketer sets the message, the Copywriter writes it, the SMM packs it for each network. The SEO agent feeds them keywords. Security reads everything public before it goes out.

A missing role is proposed as a card. Nobody adds a role alone.

## Running an agent

The definitions live in `.claude/agents/`. Start one in a thread of its own:

- In T3 Code or Claude Code: `Запусти агента cto: <task>`.
- From a terminal: `claude --agent cto "<task>"`.

The morning standup is the CEO run described in `docs/office/standup.md`. It runs every day at 08:30 Europe/Kyiv as the T3 Code scheduled task «Ранкова планірка».

Every run ends with three things: cards on the Board, entries in the Journal, and a 5-10 line reply in Ukrainian.

## Autonomy

1. The owner decides. An agent prepares 2-3 options and one recommendation.
2. An agent does alone whatever is internal and fits in 2 hours: analysis, drafts, research, tests, work on staging, local uncommitted edits on a branch, Journal and Board updates.
3. A card is needed for anything a person on the internet can see (a post, an in-app text, a store page, the landing, anything in `main` or production, a release), for any spend, and for any task longer than 2 hours.
4. Git: no commit, push or PR without the owner's permission. An approved card is that permission for the steps in its `afterApproval` and for nothing else. A release, an EAS build, a spend and a legal text each need the owner's separate yes, even inside an approved card.
5. One post, one card.
6. Every action is journaled, small ones too.
7. Content shows no owner face and no owner voice: animated word cards, screen recordings, the app's own Narrator Voices, music.

## The Board

The Board (the owner calls it «Пульт») is a published artifact with a shared database:

https://claude.ai/artifact/Sv4ixZ1cei5wUcYJ4M1oVA

Agents read and write it with the `ArtifactData` tool (load it with `ToolSearch` first). When the tool is missing, write the same JSON to `~/Downloads/WORD/office/inbox/<id>.json` and say so in the reply; the CEO uploads the inbox at the next standup.

| Collection | Document  | Holds                                                           |
| ---------- | --------- | --------------------------------------------------------------- |
| `cards`    | `<id>`    | One card; the owner's decision lands in `status` and `decision` |
| `journal`  | `<id>`    | One Journal entry                                               |
| `kpi`      | `current` | The latest KPI numbers and the weekly download series           |

### Card

A card is one decision or one approval. The owner must be able to decide without opening anything else. All text is Ukrainian.

```json
{
  "id": "cto-005",
  "agent": "cto",
  "title": "short, names the decision",
  "priority": "P0",
  "due": "2026-12-05",
  "effort": "the work after approval, e.g. «2 год»",
  "summary": "1-2 sentences: what is asked",
  "context": "what is there now, with facts",
  "problem": "why it matters for the goals",
  "options": [{ "name": "А. …", "pros": ["…"], "cons": ["…"], "effort": "…" }],
  "recommendation": { "option": "А", "why": "…" },
  "risks": ["…"],
  "afterApproval": ["the exact step the approval allows", "the next one"],
  "viz": [],
  "links": [{ "label": "path:line", "href": "https://github.com/ToxaNn1/slovo/blob/main/…" }],
  "sources": [{ "label": "…", "url": "https://…" }],
  "assumptions": ["…"],
  "status": "new",
  "createdAt": "2026-11-27T18:00:00+02:00"
}
```

- `id` is `<agent>-<next number>`; list the collection first so the number is free.
- `priority`: `P0` blocks the release or a goal, `P1` is needed before 15.12, `P2` is later.
- 2-3 options. A fact carries a `links` or `sources` entry; the rest goes to `assumptions`.
- `viz` carries 1-2 visuals as plain data (never HTML): `post`, `store`, `screen`, `diff`, `flow`, `bars`, `table`, `code`. Field lists: `~/Downloads/WORD/office/research/BRIEF.md`.
- `status`: the agent writes `new`. The owner's buttons write `approved`, `rejected` or `changes` together with `decision: { comment, at }`. The agent that finishes an approved card writes `done`.

Reading decisions: query `cards` where `status` is `approved` or `changes` and `agent` is yours. A `changes` card is reworked and set back to `new`. Pin every write with the `version` you read.

### Journal entry

```json
{
  "at": "2026-11-28T08:40:00+02:00",
  "agent": "smm",
  "what": "what was done",
  "why": "the reason",
  "where": "the file, the card id or the link to look at",
  "rollback": "how to undo it"
}
```

The document id is `<YYYYMMDD-HHmm>-<agent>-<n>`. The Journal lives in the Board, not in the repo: the repo is public and takes changes through PRs only. At each standup the CEO saves the day's entries to `~/Downloads/WORD/office/journal/<YYYY-MM-DD>.md`, so the owner keeps a copy that outlives the Board.

## Files

- Office files outside the repo go to `~/Downloads/WORD/office/`; a day's posts to `~/Downloads/WORD/smm/<date>/`.
- The research of 27.11.2026 that the plan stands on: `~/Downloads/WORD/office/research/`.
- Service keys: `~/projects/SLOVO/.env`, read by variable name, never printed.
