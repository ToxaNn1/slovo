#!/usr/bin/env node
// SessionStart: sets this repo's commit identity to the owner's when it
// differs, so no session commits under another address. The address comes
// from `.github/owner-email`; without that file nothing happens. Any error is
// swallowed: the hook never fails a session.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const OWNER_NAME = 'anton';

try {
  const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  const file = path.join(root, '.github', 'owner-email');
  if (fs.existsSync(file)) {
    const email = fs.readFileSync(file, 'utf8').trim();
    const git = (...args) =>
      execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: 'pipe' }).trim();
    let current = '';
    try {
      current = git('config', '--local', 'user.email');
    } catch {
      // No repo-local address yet.
    }
    if (email !== '' && current !== email) {
      git('config', '--local', 'user.email', email);
      git('config', '--local', 'user.name', OWNER_NAME);
      console.log(`git identity: repo-local user set to ${OWNER_NAME} <${email}>`);
    }
  }
} catch {
  // Never fail the session.
}
