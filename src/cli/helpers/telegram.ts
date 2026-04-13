/**
 * Telegram Bot API helpers for CLI setup.
 */

interface TelegramBotInfo {
  id: number;
  username: string;
  firstName: string;
}

/**
 * TODO: Validate a Telegram bot token by calling the getMe API.
 * Returns bot info if valid, null if invalid.
 */
export async function validateBotToken(
  _token: string
): Promise<TelegramBotInfo | null> {
  // TODO: fetch https://api.telegram.org/bot{token}/getMe
  throw new Error("TODO: implement validateBotToken");
}

/**
 * TODO: Register a webhook URL for the Telegram bot.
 * Called after server deployment to point Telegram at the server's webhook endpoint.
 */
export async function setWebhook(
  _botToken: string,
  _webhookUrl: string,
  _webhookSecret: string
): Promise<boolean> {
  // TODO: POST to https://api.telegram.org/bot{token}/setWebhook
  // with url and secret_token parameters
  throw new Error("TODO: implement setWebhook");
}

/**
 * TODO: Validate that a Telegram user ID looks correct (numeric string).
 */
export function validateUserId(_userId: string): boolean {
  // TODO: check format — should be a positive integer
  throw new Error("TODO: implement validateUserId");
}
