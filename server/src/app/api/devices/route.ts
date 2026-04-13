import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/devices — List all registered devices with status.
 *
 * TODO: Implement:
 * 1. Validate auth (master secret or device token)
 * 2. Call listDevicesWithStatus() from devices.ts
 * 3. Return array of devices with online/offline status
 *
 * Response: { devices: DeviceWithStatus[] }
 */
export async function GET(
  _request: NextRequest
): Promise<NextResponse> {
  // TODO: validate auth, list devices with status
  throw new Error("TODO: implement GET /api/devices");
}
