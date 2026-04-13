import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/relay/register — Register a new device.
 *
 * TODO: Implement:
 * 1. Parse body: { code, name, os, description, capabilities, ssh }
 * 2. Validate the one-time setup code (validateSetupCode from auth.ts)
 * 3. Check device name isn't already taken
 * 4. Register the device in Redis (registerDevice from devices.ts)
 * 5. Issue a per-device token (issueDeviceToken from auth.ts)
 * 6. Return { token, device: name }
 *
 * Error responses:
 * - 400: missing fields
 * - 401: invalid or expired setup code
 * - 409: device name already registered
 */
export async function POST(
  _request: NextRequest
): Promise<NextResponse> {
  // TODO: validate setup code, register device, issue token
  throw new Error("TODO: implement POST /api/relay/register");
}
