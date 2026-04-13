import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";

export async function GET(): Promise<NextResponse> {
  try {
    await redis.ping();
    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      redis: "connected",
    });
  } catch (e) {
    return NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        redis: "error",
        message: e instanceof Error ? e.message : String(e),
      },
      { status: 503 }
    );
  }
}
