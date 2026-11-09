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

/**
 * The bot that talks to the owner alone: a message to any chat but the
 * configured one is `refused` and never leaves. Telegram unreachable or
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
        });
        return response.ok ? 'sent' : 'failed';
      } catch {
        return 'failed';
      }
    },
  };
}
