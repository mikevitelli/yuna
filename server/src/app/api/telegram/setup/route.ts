import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/telegram/setup — Register the Telegram webhook.
 *
 * TODO: Implement:
 * 1. Validate master secret from Authorization header
 * 2. Call Telegram setWebhook API to register this server's webhook URL
 * 3. Return { ok: true, webhookUrl } on success
 * 4. Return 401 if master secret is invalid
 * 5. Return 500 if Telegram API call fails
 *
 * Called by `yuna init` after deploying the server.
 * The webhook URL is: {serverUrl}/api/telegram/webhook
 */
export async function POST(
  _request: NextRequest
): Promise<NextResponse> {
  // TODO: validate master secret, set Telegram webhook
  throw new Error("TODO: implement POST /api/telegram/setup");
}
