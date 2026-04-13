/**
 * Dynamic tool generation from the device registry.
 *
 * Instead of hardcoded tools, buildDeviceTools() reads all registered devices
 * from Redis and generates Claude tool definitions dynamically.
 */

/** Claude API tool definition */
export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
}

/**
 * TODO: Build Claude tool definitions from the device registry.
 *
 * For each registered device, generates:
 * - `run_on_{deviceName}` — execute a bash command on the device
 *
 * Also generates shared tools:
 * - `read_file` — read a file (with device enum from registry)
 * - `write_file` — write a file (with device enum from registry)
 *
 * Device descriptions include OS, capabilities, online/offline status,
 * and SSH reachability info for mesh networking.
 */
export async function buildDeviceTools(): Promise<ToolDefinition[]> {
  // TODO:
  // 1. listDevicesWithStatus() to get all devices
  // 2. For each device, create run_on_{name} tool with device-specific description
  // 3. Create read_file and write_file tools with device enum
  // 4. Return array of tool definitions
  throw new Error("TODO: implement buildDeviceTools");
}

/**
 * TODO: Map a tool name to its target device.
 *
 * - `run_on_{deviceName}` → deviceName
 * - `read_file` / `write_file` → extract from input.device field
 *
 * Returns null if tool doesn't map to a device (shouldn't happen).
 */
export function toolToDevice(
  _toolName: string,
  _input: Record<string, unknown>
): string | null {
  // TODO: parse tool name, extract device from run_on_ prefix or input.device field
  throw new Error("TODO: implement toolToDevice");
}
