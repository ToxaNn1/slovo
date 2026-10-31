#!/usr/bin/env node
// SLOVO token budget, enforced on every session of this repo, local and cloud.
// Cost = context size × steps × model price, so the hook caps the context,
// blocks forks of a long context and blocks whole-file dumps of big files.
// Registered in .claude/settings.json for SessionStart, UserPromptSubmit,
// PreToolUse and PostToolUse. Any internal error lets the call through.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const LIMITS = {
  coordinator: { soft: 90_000, hard: 120_000 },
  session: { soft: 120_000, hard: 160_000 },
  subagent: { soft: 120_000, hard: 160_000 },
};
const FORK_MAX = 60_000;
const BIG_FILE = 40_000;
const NOTICE_STEP = 20_000;
const COORDINATOR = /coordinator-prompt|coordinator chat|координатор/i;

const RULES = `SLOVO token budget (enforced by .claude/hooks/token-budget.mjs, local and cloud):
- Context limits: the coordinator 90k soft / 120k hard; every other session and subagent 120k / 160k. At the hard limit every tool except git and writing a handoff file is blocked: hand off, do not push on.
- Subagents: a fresh agent with a brief of at most 1.5 KB; never a fork once the context is over 60k. Long results go to a file; return 5-10 lines.
- Models: code on Opus; Fable only for Core logic, sync, architecture, specs, the version review and proofreading; the coordinator and questions on Opus.
- Output: read in parts; never print README.md, CONTEXT.md or any file over 40 KB whole; tests and CI logs through tail or grep; a text snapshot before a screenshot.
- Start from docs/agents/map.md, not README.md.`;

const HANDOFF = `Do only this, then stop:
1. Commit and push finished work on your branch if your permission allows it (git commands still run).
2. Write a handoff of at most 2 KB (goal; what is done, with PR and issue links; what is open and its state; the next 1-3 steps; the owner's permissions verbatim) to a file whose path contains "handoff" (locally ~/.slovo-coord/handoff-<date>-<topic>.md, in the cloud /tmp/handoff.md), and print it as your final message.
3. End the turn. A fresh session continues from the handoff. Never /compact.`;

function readJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function readSlice(file, fromEnd, bytes) {
  const fd = fs.openSync(file, 'r');
  try {
    const size = fs.fstatSync(fd).size;
    const length = Math.min(size, bytes);
    const buffer = Buffer.alloc(length);
    fs.readSync(fd, buffer, 0, length, fromEnd ? size - length : 0);
    return buffer.toString('utf8');
  } finally {
    fs.closeSync(fd);
  }
}

// The last request's whole prompt: fresh input plus cache writes plus cache reads.
function lastRequest(file) {
  const lines = readSlice(file, true, 2_000_000).split('\n').reverse();
  for (const line of lines) {
    if (!line.includes('"usage"')) continue;
    const entry = readJson(line);
    const usage = entry?.message?.usage;
    if (entry?.type !== 'assistant' || !usage) continue;
    const context =
      (usage.input_tokens ?? 0) +
      (usage.cache_creation_input_tokens ?? 0) +
      (usage.cache_read_input_tokens ?? 0);
    return { context, model: String(entry.message.model ?? '') };
  }
  return { context: 0, model: '' };
}

function firstPrompt(file) {
  for (const line of readSlice(file, false, 400_000).split('\n')) {
    const entry = readJson(line);
    if (entry?.type !== 'user') continue;
    const content = entry.message?.content;
    if (typeof content === 'string') return content;
    const text = Array.isArray(content)
      ? content.find((block) => block.type === 'text')
      : undefined;
    if (text) return String(text.text);
  }
  return '';
}

function session(input) {
  const main = String(input.transcript_path ?? '');
  if (input.agent_id) {
    const own = path.join(
      path.dirname(main),
      String(input.session_id),
      'subagents',
      `agent-${input.agent_id}.jsonl`,
    );
    return { role: 'subagent', transcript: fs.existsSync(own) ? own : '' };
  }
  if (!main || !fs.existsSync(main)) return { role: 'session', transcript: '' };
  return {
    role: COORDINATOR.test(firstPrompt(main)) ? 'coordinator' : 'session',
    transcript: main,
  };
}

function statusLine(role, context) {
  return `[token budget] context ${Math.round(context / 1000)}k of ${LIMITS[role].hard / 1000}k (${role}).`;
}

function out(object) {
  process.stdout.write(JSON.stringify(object));
}

function deny(reason) {
  out({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  });
}

function inject(event, text) {
  out({ hookSpecificOutput: { hookEventName: event, additionalContext: text } });
}

function isProjectFile(file, names, cwd) {
  const root = process.env.CLAUDE_PROJECT_DIR ?? cwd;
  const resolved = path.resolve(cwd, file);
  return names.some((name) => resolved === path.join(root, name));
}

function fileSize(file, cwd) {
  try {
    return fs.statSync(path.resolve(cwd, file.replace(/^~(?=\/)/, os.homedir()))).size;
  } catch {
    return 0;
  }
}

// A dump is `cat FILE` whose output is not piped on: README.md, CONTEXT.md or any file over 40 KB.
function bashDump(command, cwd) {
  for (const segment of command.split(/&&|\|\||;|\n/)) {
    if (segment.includes('|')) continue;
    const match = /^\s*cat\s+([^<>]+?)\s*$/.exec(segment);
    if (!match) continue;
    for (const file of match[1].split(/\s+/).filter((word) => !word.startsWith('-'))) {
      const clean = file.replace(/^["']|["']$/g, '');
      if (isProjectFile(clean, ['README.md', 'CONTEXT.md'], cwd) || fileSize(clean, cwd) > BIG_FILE)
        return clean;
    }
  }
  if (/\bgh\s+run\s+view\b[^|]*--log(?!-failed)\b/.test(command) && !command.includes('|'))
    return 'the CI log';
  return undefined;
}

function preToolUse(input, role, context, model) {
  const tool = String(input.tool_name ?? '');
  const toolInput = input.tool_input ?? {};
  const cwd = String(input.cwd ?? process.cwd());
  const command = String(toolInput.command ?? '');

  if (role === 'coordinator' && model.includes('fable') && !/^\s*git\s/.test(command))
    return deny(
      'The SLOVO coordinator runs on Opus, never Fable (token budget rule). Stop and ask the owner to switch with /model opus, then continue.',
    );

  if (context >= LIMITS[role].hard) {
    const handoffWrite =
      (tool === 'Write' || tool === 'Edit') &&
      String(toolInput.file_path ?? '').includes('handoff');
    const gitOnly = tool === 'Bash' && /^\s*git\s/.test(command) && !/[;&|]/.test(command);
    if (!handoffWrite && !gitOnly)
      return deny(
        `HARD LIMIT: ${statusLine(role, context)} Every tool except git and the handoff file is blocked.\n${HANDOFF}`,
      );
  }

  if (tool === 'Agent' && toolInput.subagent_type === 'fork' && context > FORK_MAX)
    return deny(
      `A fork would copy this ${Math.round(context / 1000)}k context into every worker. Launch a fresh agent instead (omit subagent_type or name a type) with a brief of at most 1.5 KB: the goal, what is ruled out, the files to read by path, the result format; long results go to a file.`,
    );

  if (
    tool === 'Read' &&
    toolInput.limit === undefined &&
    isProjectFile(String(toolInput.file_path ?? ''), ['README.md', 'CONTEXT.md'], cwd)
  )
    return deny(
      'Do not read README.md or CONTEXT.md whole. Use `grep -n` for the terms you need and read those lines with offset and limit; the repo map is docs/agents/map.md.',
    );

  if (tool === 'Bash') {
    const dump = bashDump(command, cwd);
    if (dump)
      return deny(
        `Do not print ${dump} whole into the session. Use grep -n, sed -n 'A,Bp', head or tail; for CI use gh run view --log-failed | tail -80.`,
      );
  }
}

// One notice each time the context crosses the soft limit by another 20k, so autonomous runs see it too.
function postToolUse(input, role, context) {
  const { soft, hard } = LIMITS[role];
  if (context < soft || context >= hard) return;
  const bucket = Math.floor((context - soft) / NOTICE_STEP);
  const dir = path.join(os.tmpdir(), 'slovo-token-budget');
  const key = path.join(dir, `${input.session_id}-${input.agent_id ?? 'main'}.json`);
  const seen = readJson(fs.existsSync(key) ? fs.readFileSync(key, 'utf8') : '')?.bucket ?? -1;
  if (bucket <= seen) return;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(key, JSON.stringify({ bucket }));
  inject(
    'PostToolUse',
    `${statusLine(role, context)} Soft limit passed: finish the current step, start nothing big, and plan the handoff before ${hard / 1000}k.`,
  );
}

function main() {
  const input = readJson(fs.readFileSync(0, 'utf8'));
  if (!input) return;
  const event = String(input.hook_event_name ?? '');
  if (event === 'SessionStart') return inject(event, RULES);

  const { role, transcript } = session(input);
  const { context, model } = transcript ? lastRequest(transcript) : { context: 0, model: '' };

  if (event === 'UserPromptSubmit') {
    const notes = [statusLine(role, context)];
    if (context >= LIMITS[role].hard) notes.push(`HARD LIMIT reached. ${HANDOFF}`);
    else if (context >= LIMITS[role].soft)
      notes.push('Soft limit passed: finish this step and plan the handoff.');
    if (role === 'coordinator' && model.includes('fable'))
      notes.push('The coordinator runs on Opus: ask the owner to switch with /model opus first.');
    return inject(event, notes.join(' '));
  }
  if (event === 'PreToolUse') return preToolUse(input, role, context, model);
  if (event === 'PostToolUse') return postToolUse(input, role, context);
}

try {
  main();
} catch {
  // A broken budget check must never block work.
}
