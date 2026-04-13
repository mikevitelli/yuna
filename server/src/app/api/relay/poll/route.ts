import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/relay/poll — Device polls for pending commands.
 *
 * TODO: Implement:
 * 1. Validate device token → get device identity
 * 2. Update lastSeen timestamp for the device
 * 3. XREADGROUP from device's stream (yuna:stream:{deviceName})
 * 4. If command found: return { command: WireCommand, streamId }
 * 5. If no command: check XPENDING for stale messages (>60s), reclaim with XCLAIM
 * 6. If still nothing: return { command: null, streamId: null }
 */
export async function GET(
  _request: NextRequest
): Promise<NextResponse> {
  // TODO: validate token, read from device stream
  throw new Error("TODO: implement GET /api/relay/poll");
}
