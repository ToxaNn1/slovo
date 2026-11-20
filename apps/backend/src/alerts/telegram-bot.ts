/** What became of a message to a Telegram chat. */
export type TelegramResult = 'sent' | 'refused' | 'failed';

/** The Telegram Bot API, narrowed to the one call the backend makes. */
export interface TelegramPort {
  sendMessage(chatId: string, text: string): Promise<TelegramResult>;
}

export interface TelegramBotOptions {
  readonly token: string;
  /** The owner's chat: the only chat a message goes to. */
  readonly chatId: string;
  readonly fetch?: typeof fetch;
  readonly baseUrl?: string;
}

/** How long a call to Telegram may take before it is `failed`, so no alert holds its caller. */
const TIMEOUT_MS = 10_000;

/**
 * The bot that talks to the owner alone: a message to any chat but the
 * configured one is `refused` and never leaves. Telegram unreachable, silent or
 * refusing the call is `failed`, never a throw.
 */
export function createTelegramBot({
  token,
  chatId,
  fetch: fetchWith = fetch,
  baseUrl = 'https://api.telegram.org',
}: TelegramBotOptions): TelegramPort {
  return {
    async sendMessage(to, text) {
      if (to !== chatId) return 'refused';
      try {
        const response = await fetchWith(new URL(`/bot${token}/sendMessage`, baseUrl), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        return response.ok ? 'sent' : 'failed';
      } catch {
        return 'failed';
      }
    },
  };
}
