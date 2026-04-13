import { NextRequest, NextResponse } from "next/server";
import { validateMasterSecretHeader, validateDeviceToken } from "@/lib/auth";
import { listDevicesWithStatus } from "@/lib/devices";

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Accept either master secret OR device token for reading the device list
  const masterOk = await validateMasterSecretHeader(request);
  if (!masterOk) {
    const deviceAuth = await validateDeviceToken(request);
    if (!deviceAuth) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const devices = await listDevicesWithStatus();
  return NextResponse.json({ devices });
}
