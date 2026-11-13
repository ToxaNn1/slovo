import {
  systemClock,
  type Actor,
  type Alert,
  type AlertStore,
  type Alerts,
  type Clock,
  type Digest,
  type OwnerChat,
} from '@slovo/server-core';
import type { Logger } from 'pino';

import type { TelegramConfig } from '../config';
import type { Database } from '../database/database';
import { createAlertStore } from './alert-store';
import { createTelegramBot, type TelegramPort } from './telegram-bot';

const number = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2 });
const n = (value: number) => number.format(value);
const orDash = (value: number | null) => (value === null ? '—' : n(value));

function actorText(who: Actor): string {
  if (who.kind === 'admin-user') return who.email;
  if (who.kind === 'agent') return `Агент ${who.name}`;
  return `команда ${who.command}`;
}

/** The message the owner reads of an alert. */
export function alertText(alert: Alert): string {
  switch (alert.kind) {
    case 'kill-switch':
      return `⛔ Kill switch: «${alert.feature}» вимкнено в ${alert.editionIds.join(', ')}.\nХто: ${actorText(alert.who)}\nПричина: ${alert.reason}`;
    case 'crash-free':
      return `📉 Сесій без падінь за 24 год: ${n(alert.percent)} % (поріг ${n(alert.threshold)} %).`;
    case 'sentry-issue':
      return `🐞 Нова помилка в Sentry: ${n(alert.events)} подій за годину (поріг ${n(alert.threshold)}).`;
    case 'ci-red':
      return `🔴 CI на main червоний: ${alert.sha.slice(0, 7)}, тестів упало: ${n(alert.failedTests.length)}.${alert.failedTests.length > 0 ? `\n${alert.failedTests.slice(0, 5).join('\n')}` : ''}`;
    case 'api-errors':
      return `⚠️ Помилки API 5xx за 15 хв: ${n(alert.percent)} % (поріг ${n(alert.threshold)} %).`;
    case 'activity-drop':
      return `📉 Активність упала: ${alert.day} активних ${n(alert.active)}, у середньому за 7 днів ${n(alert.average)} (поріг падіння ${n(alert.threshold)} %).`;
    case 'backend-down':
      return '🚨 Бекенд не відповідає на перевірку здоров’я.';
    case 'batch-size':
      return `📦 Велика пачка у черзі ${alert.editionId}: ${n(alert.records)} записів (поріг ${n(alert.threshold)}).`;
  }
}

/** The daily digest the owner reads at 09:00 Kyiv. */
function digestText(digest: Digest): string {
  const ci =
    digest.lastCi === null
      ? 'немає запусків за 7 днів'
      : `${digest.lastCi.sha.slice(0, 7)} ${digest.lastCi.failedTests === 0 ? 'зелений' : `червоний, тестів упало: ${n(digest.lastCi.failedTests)}`}`;
  return [
    `☀️ Зведення за ${digest.day}`,
    `Активних людей: ${orDash(digest.active)}`,
    `Відвідин: ${orDash(digest.visits)}`,
    `Падінь за 24 год: ${orDash(digest.crashes)}`,
    `CI на main: ${ci}`,
    `Відкритих пачок: ${n(digest.openBatches)} (${n(digest.openRecords)} записів)`,
  ].join('\n');
}

/**
 * The owner's chat over the Telegram bot, or none while the bot is not set
 * up: then nothing leaves, and the alerts stay unsent for the next run.
 */
export function createOwnerChat(
  bot: { readonly telegram: TelegramPort; readonly chatId: string } | undefined,
  logger: Logger,
): OwnerChat {
  return {
    async send(message) {
      const text = message.kind === 'alert' ? alertText(message.alert) : digestText(message.digest);
      if (bot === undefined) {
        const kind = message.kind === 'alert' ? message.alert.kind : message.kind;
        // The kind alone: an alert can name the Admin user who turned a switch off.
        logger.warn({ kind }, 'owner chat: the Telegram bot is not set up');
        return false;
      }
      const result = await bot.telegram.sendMessage(bot.chatId, text);
      if (result !== 'sent') logger.warn({ result }, 'owner chat: the message did not leave');
      return result === 'sent';
    },
  };
}

/** Alerts told at once, as the Kill switch's: kept for Огляд, then sent. */
function createOwnerAlerts({
  store,
  chat,
  clock,
}: {
  store: AlertStore;
  chat: OwnerChat;
  clock: Clock;
}): Alerts {
  return {
    async send(alert) {
      const now = clock.now();
      const id = await store.keep(alert, now, null);
      if (id !== null && (await chat.send({ kind: 'alert', alert }))) {
        await store.markSent(id, clock.now());
      }
    },
  };
}

/** The owner's chat over the bot the environment sets up, or none. */
export function ownerChatOf(
  { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID }: TelegramConfig,
  logger: Logger,
): OwnerChat {
  return createOwnerChat(
    TELEGRAM_BOT_TOKEN === undefined || TELEGRAM_CHAT_ID === undefined
      ? undefined
      : {
          telegram: createTelegramBot({ token: TELEGRAM_BOT_TOKEN, chatId: TELEGRAM_CHAT_ID }),
          chatId: TELEGRAM_CHAT_ID,
        },
    logger,
  );
}

/** The Alerts of the server and the commands: kept in the database, sent over the environment's bot. */
export function ownerAlertsOf(
  database: Database,
  telegram: TelegramConfig,
  logger: Logger,
): Alerts {
  return createOwnerAlerts({
    store: createAlertStore(database),
    chat: ownerChatOf(telegram, logger),
    clock: systemClock,
  });
}
