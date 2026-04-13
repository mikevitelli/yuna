/**
 * Telegram Bot API helpers for the server.
 * Copied from shiny-politoed — generic, no changes needed.
 */

/**
 * TODO: Send a text message to a Telegram chat.
 * Handles message length limits (4096 chars) by splitting into multiple messages.
 */
export async function sendMessage(
  _chatId: number,
  _text: string,
  _options?: {
    replyToMessageId?: number;
    parseMode?: "HTML" | "Markdown" | "MarkdownV2";
  }
): Promise<void> {
  // TODO: POST to https://api.telegram.org/bot{token}/sendMessage
  throw new Error("TODO: implement sendMessage");
}

/**
 * TODO: Send a "typing" indicator to a Telegram chat.
 * Shows "..." typing animation while processing.
 */
export async function sendTypingAction(_chatId: number): Promise<void> {
  // TODO: POST to https://api.telegram.org/bot{token}/sendChatAction
  throw new Error("TODO: implement sendTypingAction");
}

/**
 * TODO: Edit an existing message in a Telegram chat.
 */
export async function editMessage(
  _chatId: number,
  _messageId: number,
  _text: string,
  _parseMode?: "HTML" | "Markdown" | "MarkdownV2"
): Promise<void> {
  // TODO: POST to https://api.telegram.org/bot{token}/editMessageText
  throw new Error("TODO: implement editMessage");
}

/**
 * TODO: Validate the webhook secret header from Telegram.
 * Compares X-Telegram-Bot-Api-Secret-Token against TELEGRAM_WEBHOOK_SECRET.
 */
export function validateWebhookSecret(_secretHeader: string | null): boolean {
  // TODO: compare against process.env.TELEGRAM_WEBHOOK_SECRET
  throw new Error("TODO: implement validateWebhookSecret");
}
