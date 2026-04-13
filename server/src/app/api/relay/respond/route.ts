import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/relay/respond — Device posts command execution result.
 *
 * TODO: Implement:
 * 1. Validate device token → get device identity
 * 2. Parse body: { device, taskId, output, exitCode, streamId }
 * 3. XACK the processed stream message
 * 4. Load the orchestration task by taskId
 * 5. Call resumeTask() to continue the agentic loop
 * 6. Log to audit log
 * 7. Return { ok: true }
 */
export async function POST(
  _request: NextRequest
): Promise<NextResponse> {
  // TODO: validate token, process response, resume orchestration
  throw new Error("TODO: implement POST /api/relay/respond");
}
