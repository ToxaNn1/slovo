#!/usr/bin/env node
// SLOVO cloud sessions run unattended: nobody watches the browser, so a permission prompt stalls the whole wave.
// In a cloud session (Claude Code on the web) this hook approves every tool call and turns a question to the owner
// into a decision the session takes itself. Locally it does nothing.
// A deny from another hook (token budget, commit messages) still wins: Claude Code takes deny over allow.
import fs from 'node:fs';

if (process.env.CLAUDE_CODE_REMOTE !== 'true') process.exit(0);

let tool = '';
try {
  tool = JSON.parse(fs.readFileSync(0, 'utf8')).tool_name ?? '';
} catch {
  process.exit(0);
}

const ASKS_THE_OWNER = new Set(['AskUserQuestion', 'ExitPlanMode']);

const decision = ASKS_THE_OWNER.has(tool)
  ? {
      permissionDecision: 'deny',
      permissionDecisionReason:
        'This cloud session runs unattended and nobody will answer. Take the decision yourself from the ticket, CONTEXT.md and the ADRs, write it under "Decisions" in your report, and carry on. If the ticket truly cannot go on, end with a STUCK status commit that names the question.',
    }
  : {
      permissionDecision: 'allow',
      permissionDecisionReason: 'SLOVO cloud session: approved without a prompt.',
    };

process.stdout.write(
  JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', ...decision } }),
);
