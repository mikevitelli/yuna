/**
 * Wire protocol types and helpers for device ↔ server communication.
 * Re-exports shared types and adds agent-specific utilities.
 */

export type { WireCommand, DeviceResponse } from "../shared/types.js";

/** Poll response from GET /api/relay/poll */
export interface PollResponse {
  command: import("../shared/types.js").WireCommand | null;
  streamId: string | null;
}

/** Registration request for POST /api/relay/register */
export interface RegisterRequest {
  code: string;
  name: string;
  os: string;
  description: string;
  capabilities: string[];
  ssh: Record<string, string>;
}

/** Registration response from POST /api/relay/register */
export interface RegisterResponse {
  token: string;
  device: string;
}

/**
 * TODO: Parse a raw Redis stream message into a WireCommand.
 */
export function parseWireCommand(
  _raw: Record<string, string>
): import("../shared/types.js").WireCommand {
  throw new Error("TODO: implement parseWireCommand");
}

/**
 * TODO: Serialize a DeviceResponse for POST /api/relay/respond.
 */
export function serializeResponse(
  _response: import("../shared/types.js").DeviceResponse
): string {
  throw new Error("TODO: implement serializeResponse");
}
