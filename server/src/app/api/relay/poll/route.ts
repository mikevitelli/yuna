import { NextRequest, NextResponse } from "next/server";
import { validateDeviceToken } from "@/lib/auth";
import { touchDevice } from "@/lib/devices";
import { readFromStream, reclaimPending } from "@/lib/redis";

export const maxDuration = 30;

const LONG_POLL_MS = 25_000;
const CHECK_INTERVAL_MS = 2_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await validateDeviceToken(request);
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const device = auth.device;
  await touchDevice(device);

  // 1. Reclaim unacked messages first (crash recovery)
  const reclaimed = await reclaimPending(device);
  if (reclaimed.length > 0) {
    return NextResponse.json({
      messages: reclaimed.map(entryToMessage),
    });
  }

  // 2. Long-poll: check every 2s up to 25s
  const deadline = Date.now() + LONG_POLL_MS;
  while (Date.now() < deadline) {
    const entries = await readFromStream(device);
    if (entries.length > 0) {
      return NextResponse.json({
        messages: entries.map(entryToMessage),
      });
    }
    await sleep(CHECK_INTERVAL_MS);
  }

  return NextResponse.json({ messages: [] });
}

function entryToMessage(entry: {
  id: string;
  fields: Record<string, string>;
}) {
  return {
    streamId: entry.id,
    taskId: entry.fields.taskId,
    tool: entry.fields.tool,
    input: parseJson(entry.fields.input) || {},
    chatId: Number(entry.fields.chatId),
    messageId: Number(entry.fields.messageId),
    timestamp: entry.fields.timestamp,
  };
}

function parseJson(raw: string | undefined): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
