// `pnpm switch:off <edition-id> <feature>` and `pnpm switch:clear <edition-id> <feature>`:
// turns a feature off in an Edition remotely on the database DATABASE_URL
// names, or clears that switch, so every app of the Edition and the backend
// itself obey it without a build (ADR 0040).
import { parseArgs } from 'node:util';

import { FeatureSwitchesSchema } from '@slovo/contracts';
import { systemClock, type SwitchRefusal } from '@slovo/server-core';

import { PublishConfigSchema, readConfig } from '../config';
import { createDatabase } from '../database/database';
import { createLogger } from '../logger';
import { readEditions } from './edition-folders';
import { setRemoteSwitch } from './set-remote-switch';

/** What the owner reads when a switch is refused. */
const REFUSALS: Record<SwitchRefusal, string> = {
  'unknown-edition': 'the backend does not find the Edition in EDITIONS_DIR.',
  'unknown-feature': `the Feature Switches are ${FeatureSwitchesSchema.keyof().options.join(', ')}.`,
};

/** The two commands, by the word the package script passes first. */
const COMMANDS = { off: 'switch:off', clear: 'switch:clear' } as const;

async function main(): Promise<number> {
  const { positionals } = parseArgs({ allowPositionals: true });
  const [command, editionId, feature, ...rest] = positionals;
  if (command !== 'off' && command !== 'clear') {
    throw new Error(`the switch command is "off" or "clear", not ${String(command)}`);
  }
  if (editionId === undefined || feature === undefined || rest.length > 0) {
    console.error(`Usage: pnpm ${COMMANDS[command]} <edition-id> <feature>`);
    return 2;
  }
  const { DATABASE_URL, EDITIONS_DIR } = readConfig(PublishConfigSchema, process.env);
  const database = createDatabase(DATABASE_URL, createLogger());
  try {
    const set = await setRemoteSwitch({
      database,
      clock: systemClock,
      editions: readEditions(EDITIONS_DIR),
      editionId,
      feature,
      off: command === 'off',
    });
    if (!set.ok) {
      console.error(
        `Feature Switch "${feature}" of "${editionId}" not set: ${REFUSALS[set.reason]}`,
      );
      return 1;
    }
    console.log(
      command === 'off'
        ? `Turned "${feature}" off in "${editionId}"`
        : `Cleared the remote switch of "${feature}" in "${editionId}"`,
    );
    console.log(`  off remotely: ${set.off.length > 0 ? set.off.join(', ') : 'none'}`);
    return 0;
  } finally {
    await database.close();
  }
}

process.exitCode = await main();
