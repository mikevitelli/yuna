import { NextRequest, NextResponse } from "next/server";
import { validateMasterSecretHeader } from "@/lib/auth";
import { setWebhook } from "@/lib/telegram";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authorized = await validateMasterSecretHeader(request);
  if (!authorized) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  if (!url) {
    return NextResponse.json(
      { error: "url parameter required" },
      { status: 400 }
    );
  }

  try {
    const ok = await setWebhook(url);
    return NextResponse.json({ ok, webhookUrl: url });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
