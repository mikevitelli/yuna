import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/telegram/webhook — Telegram webhook receiver.
 *
 * TODO: Implement:
 * 1. Validate webhook secret header (X-Telegram-Bot-Api-Secret-Token)
 * 2. Parse the Telegram Update object from body
 * 3. Check TELEGRAM_OWNER_ID — reject messages from other users
 * 4. Handle commands:
 *    - /start — welcome message
 *    - /help — dynamic help text with registered device list
 *    - /status — device list with online/offline status
 *    - /reset — clear conversation history
 *    - /devices — list registered devices
 * 5. Handle regular text messages: pass to orchestrator.handleMessage()
 * 6. Rate limit per user
 * 7. Return 200 OK immediately (Telegram expects fast response)
 */
export async function POST(
  _request: NextRequest
): Promise<NextResponse> {
  // TODO: validate webhook, handle commands and messages
  throw new Error("TODO: implement POST /api/telegram/webhook");
}
