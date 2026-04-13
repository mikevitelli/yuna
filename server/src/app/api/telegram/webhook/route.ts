import { NextRequest, NextResponse } from "next/server";
import { verifyWebhook, sendMessage, sendTypingAction, escapeHtml } from "@/lib/telegram";
import { isOwner, createSetupCode, generateSetupCodeString } from "@/lib/auth";
import { handleUserMessage, clearConversationHistory } from "@/lib/orchestrator";
import { listDevicesWithStatus, removeDevice } from "@/lib/devices";
import { readLog } from "@/lib/redis";
import { isRateLimited } from "@/lib/rate-limit";

export const maxDuration = 60;

// Emoji reactions mapped to actions (matches shiny-politoed)
const REACTIONS: Record<string, string | null> = {
  "\u{1F44D}": "yes, proceed",
  "\u{1F44E}": "no, stop. revert that",
  "\u{1F504}": null, // retry (uses last prompt)
  "\u{1F680}": "ship it",
  "\u2764\uFE0F": "yes, proceed",
  "\u2764": "yes, proceed",
  "\u2705": "yes, confirmed",
  "\u274C": "cancel, don't do that",
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!verifyWebhook(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }

  // Rate limit: 30 messages per minute
  if (await isRateLimited("telegram-webhook", 30, 60)) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  const update = await request.json();

  // Reactions
  if (update.message_reaction) {
    await handleReaction(update.message_reaction);
    return NextResponse.json({ ok: true });
  }

  const message = update.message;
  if (!message?.text) {
    return NextResponse.json({ ok: true });
  }

  const chatId = message.chat.id;
  const userId = message.from?.id;
  const messageId = message.message_id;
  const text = (message.text as string).trim();

  if (!isOwner(userId)) {
    await sendMessage(chatId, "Unauthorized.");
    return NextResponse.json({ ok: true });
  }

  // ─── Built-in commands ────────────────────────────────────────────
  if (text === "/start") {
    await sendStart(chatId);
    return NextResponse.json({ ok: true });
  }

  if (text === "/status" || text === "/ping") {
    await sendStatus(chatId);
    return NextResponse.json({ ok: true });
  }

  if (text === "/reset") {
    await clearConversationHistory();
    await sendMessage(chatId, "Conversation cleared.");
    return NextResponse.json({ ok: true });
  }

  if (text === "/create-code") {
    const code = generateSetupCodeString();
    await createSetupCode(code);
    await sendMessage(
      chatId,
      `Setup code: <code>${code}</code>\n\nExpires in 10 minutes.\nUse: <code>yuna add-device --code ${code}</code>`
    );
    return NextResponse.json({ ok: true });
  }

  if (text.startsWith("/revoke ")) {
    const name = text.slice("/revoke ".length).trim();
    if (!name) {
      await sendMessage(chatId, "Usage: /revoke &lt;device-name&gt;");
      return NextResponse.json({ ok: true });
    }
    await removeDevice(name);
    await sendMessage(chatId, `Device "${escapeHtml(name)}" revoked.`);
    return NextResponse.json({ ok: true });
  }

  if (text === "/logs") {
    await sendLogs(chatId);
    return NextResponse.json({ ok: true });
  }

  if (text.startsWith("/")) {
    await sendMessage(
      chatId,
      `Unknown command: ${escapeHtml(text.split(" ")[0])}`
    );
    return NextResponse.json({ ok: true });
  }

  // ─── Regular message → orchestrator ───────────────────────────────
  await sendTypingAction(chatId);
  try {
    await handleUserMessage(chatId, messageId, text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sendMessage(chatId, `Error: ${escapeHtml(msg)}`);
  }

  return NextResponse.json({ ok: true });
}

// ─── Command handlers ────────────────────────────────────────────────────────

async function sendStart(chatId: number): Promise<void> {
  const botName = process.env.BOT_NAME || "Yuna";
  await sendMessage(
    chatId,
    `<b>${escapeHtml(botName)}</b> ready.\n\n` +
      `Just type a message — I decide which device handles it.\n\n` +
      `<b>Commands:</b>\n` +
      `/status — device list\n` +
      `/reset — clear conversation\n` +
      `/create-code — new device setup code\n` +
      `/revoke &lt;name&gt; — revoke a device\n` +
      `/logs — recent audit log\n\n` +
      `<b>Model override:</b>\n` +
      `<code>@opus &lt;task&gt;</code>\n` +
      `<code>@sonnet &lt;task&gt;</code>\n` +
      `<code>@haiku &lt;task&gt;</code> (default)`
  );
}

async function sendStatus(chatId: number): Promise<void> {
  const devices = await listDevicesWithStatus();
  if (devices.length === 0) {
    await sendMessage(chatId, "No devices registered. Use /create-code to add one.");
    return;
  }

  const lines: string[] = ["<b>Devices:</b>"];
  for (const d of devices) {
    const status = d.online ? "\u{1F7E2}" : "\u{1F534}";
    const ago = d.lastSeen ? timeSince(new Date(d.lastSeen)) : "never";
    lines.push(`  ${status} <b>${escapeHtml(d.name)}</b> — ${escapeHtml(d.os)} — seen ${ago}`);
  }
  await sendMessage(chatId, lines.join("\n"));
}

async function sendLogs(chatId: number): Promise<void> {
  const entries = await readLog(20);
  if (entries.length === 0) {
    await sendMessage(chatId, "(no log entries)");
    return;
  }
  const lines = entries.map((e) => {
    const ts = new Date(e.ts).toISOString().slice(11, 19);
    const cmd = e.command ? escapeHtml(e.command.slice(0, 60)) : "";
    return `<code>${ts}</code> [${e.type}] ${escapeHtml(e.device)} ${escapeHtml(e.tool)} ${cmd}`;
  });
  await sendMessage(chatId, lines.join("\n"));
}

async function handleReaction(reaction: Record<string, unknown>): Promise<void> {
  const chatId = (reaction.chat as Record<string, unknown>)?.id as number;
  const userId = (reaction.user as Record<string, unknown>)?.id as number;
  const msgId = reaction.message_id as number;
  const newReactions = reaction.new_reaction as Array<Record<string, string>>;

  if (!chatId || !msgId || !isOwner(userId) || !newReactions?.length) return;
  const emoji = newReactions[0]?.emoji;
  if (!emoji || !(emoji in REACTIONS)) return;

  const action = REACTIONS[emoji] || "retry the previous action";
  await sendTypingAction(chatId);
  try {
    await handleUserMessage(chatId, msgId, action);
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    await sendMessage(chatId, `Error: ${escapeHtml(errMsg)}`);
  }
}

function timeSince(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
