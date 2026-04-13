const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

const MAX_MESSAGE_LENGTH = 4000;

export interface SendMessageOptions {
  replyToMessageId?: number;
  parseMode?: "HTML" | "Markdown" | "MarkdownV2";
}

// ─── Sending messages ────────────────────────────────────────────────────────

export async function sendMessage(
  chatId: number,
  text: string,
  options: SendMessageOptions = {}
): Promise<number | null> {
  const { replyToMessageId, parseMode = "HTML" } = options;
  const chunks = splitMessage(text, MAX_MESSAGE_LENGTH);
  let lastMsgId: number | null = null;

  for (const chunk of chunks) {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text: chunk,
      parse_mode: parseMode,
    };
    if (replyToMessageId && chunk === chunks[0]) {
      body.reply_to_message_id = replyToMessageId;
    }

    const res = await fetch(`${API_BASE}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (data.ok) {
      lastMsgId = data.result.message_id;
    } else {
      // Retry without parse_mode if HTML parsing failed
      body.parse_mode = undefined;
      const retryRes = await fetch(`${API_BASE}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const retryData = await retryRes.json();
      if (retryData.ok) lastMsgId = retryData.result.message_id;
    }
  }

  return lastMsgId;
}

export async function sendTypingAction(chatId: number): Promise<void> {
  await fetch(`${API_BASE}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action: "typing" }),
  });
}

// Alias for backward compatibility
export const sendTyping = sendTypingAction;

export async function editMessage(
  chatId: number,
  messageId: number,
  text: string,
  parseMode: "HTML" | "Markdown" | "MarkdownV2" = "HTML"
): Promise<void> {
  await fetch(`${API_BASE}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: parseMode,
    }),
  });
}

// ─── Webhook setup ───────────────────────────────────────────────────────────

export async function setWebhook(url: string): Promise<boolean> {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET || "";
  const res = await fetch(`${API_BASE}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      secret_token: secret,
      allowed_updates: ["message", "message_reaction"],
    }),
  });
  const data = await res.json();
  return data.ok === true;
}

// ─── Verification ────────────────────────────────────────────────────────────

export function validateWebhookSecret(
  secretHeader: string | null | Request
): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) return true; // dev mode

  // Accept either a raw header string or a Request
  if (secretHeader && typeof secretHeader === "object" && "headers" in secretHeader) {
    const header = (secretHeader as Request).headers.get(
      "x-telegram-bot-api-secret-token"
    );
    return header === expected;
  }
  return secretHeader === expected;
}

// Alias used in some call sites
export const verifyWebhook = (request: Request): boolean =>
  validateWebhookSecret(request);

// ─── Formatting ──────────────────────────────────────────────────────────────

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function mdToTgHtml(text: string): string {
  let out = escapeHtml(text);

  out = out.replace(/```\w*\n([\s\S]*?)```/g, "<pre>$1</pre>");
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  out = out.replace(/__(.+?)__/g, "<b>$1</b>");
  out = out.replace(/(?<!\w)\*([^*]+?)\*(?!\w)/g, "<i>$1</i>");
  out = out.replace(/(?<!\w)_([^_]+?)_(?!\w)/g, "<i>$1</i>");
  out = out.replace(/~~(.+?)~~/g, "<s>$1</s>");
  out = out.replace(/^#{1,6}\s+(.+)$/gm, "<b>$1</b>");
  out = out.replace(/^[-*]\s+/gm, "\u2022 ");
  out = out.replace(/^---+$/gm, "\u2500".repeat(20));

  return out;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function splitMessage(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    let splitAt = remaining.lastIndexOf("\n", maxLen);
    if (splitAt < maxLen / 2) splitAt = maxLen;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt);
  }
  return chunks;
}
