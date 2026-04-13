import { NextRequest, NextResponse } from "next/server";
import { validateDeviceToken } from "@/lib/auth";
import { touchDevice } from "@/lib/devices";
import { ackStream, appendLog } from "@/lib/redis";
import { handleToolResult } from "@/lib/orchestrator";

export const maxDuration = 60;

interface RespondBody {
  taskId: string;
  output: string;
  exitCode?: number;
  streamId?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await validateDeviceToken(request);
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: RespondBody;
  try {
    body = (await request.json()) as RespondBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!body.taskId) {
    return NextResponse.json({ error: "taskId required" }, { status: 400 });
  }

  const device = auth.device;
  await touchDevice(device);

  // ACK the stream message so it's not redelivered
  if (body.streamId) {
    await ackStream(device, body.streamId);
  }

  // Log the response
  await appendLog({
    ts: new Date().toISOString(),
    type: "response",
    device,
    tool: "",
    exitCode: body.exitCode,
    outputLength: body.output?.length,
    taskId: body.taskId,
  });

  // Continue the orchestrator loop — this calls Claude again
  await handleToolResult(body.taskId, body.output || "", body.exitCode);

  return NextResponse.json({ ok: true });
}
