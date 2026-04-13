import { NextRequest, NextResponse } from "next/server";
import { validateSetupCode, issueDeviceToken } from "@/lib/auth";
import { getDevice, registerDevice } from "@/lib/devices";
import type { DeviceConfig } from "@/lib/types";

interface RegisterRequest {
  code: string;
  name: string;
  os?: string;
  description?: string;
  capabilities?: string[];
  ssh?: Record<string, string>;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: RegisterRequest;
  try {
    body = (await request.json()) as RegisterRequest;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!body.code || typeof body.code !== "string") {
    return NextResponse.json(
      { error: "setup code required" },
      { status: 400 }
    );
  }
  if (!body.name || typeof body.name !== "string") {
    return NextResponse.json(
      { error: "device name required" },
      { status: 400 }
    );
  }
  if (!/^[a-z0-9][a-z0-9-]{0,30}$/.test(body.name)) {
    return NextResponse.json(
      {
        error:
          "device name must be lowercase alphanumeric + hyphens, max 31 chars",
      },
      { status: 400 }
    );
  }

  // Validate + consume the setup code
  const valid = await validateSetupCode(body.code);
  if (!valid) {
    return NextResponse.json(
      { error: "invalid or expired setup code" },
      { status: 401 }
    );
  }

  // Check name availability
  const existing = await getDevice(body.name);
  if (existing) {
    return NextResponse.json(
      { error: `device "${body.name}" already registered` },
      { status: 409 }
    );
  }

  // Register the device
  const config: DeviceConfig = {
    name: body.name,
    os: body.os || "unknown",
    description: body.description || "",
    capabilities: body.capabilities || [],
    ssh: body.ssh || {},
    registeredAt: new Date().toISOString(),
  };
  await registerDevice(config);

  // Issue a per-device token
  const token = await issueDeviceToken(body.name);

  return NextResponse.json({
    ok: true,
    device: body.name,
    token,
  });
}
