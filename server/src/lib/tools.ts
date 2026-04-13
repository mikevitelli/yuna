import type Anthropic from "@anthropic-ai/sdk";
import { listDevicesWithStatus, type DeviceWithStatus } from "./devices";

/**
 * Build Claude tool definitions dynamically from the device registry.
 * Called at the start of every Claude API invocation.
 */
export async function buildDeviceTools(): Promise<Anthropic.Tool[]> {
  const devices = await listDevicesWithStatus();
  const deviceNames = devices.map((d) => d.name);

  const tools: Anthropic.Tool[] = [];

  for (const device of devices) {
    tools.push({
      name: `run_on_${device.name}`,
      description: buildRunDescription(device, devices),
      input_schema: {
        type: "object" as const,
        properties: {
          command: { type: "string", description: "Bash command to execute" },
          working_directory: {
            type: "string",
            description: "Working directory (default: device home)",
          },
          timeout_seconds: {
            type: "number",
            description:
              "Max execution time in seconds (default: 60, max: 300). Raise for long-running commands like builds, package installs, nested LLM calls, or network-bound operations.",
          },
        },
        required: ["command"],
      },
    });
  }

  if (deviceNames.length > 0) {
    tools.push({
      name: "read_file",
      description: "Read a file from any registered device.",
      input_schema: {
        type: "object" as const,
        properties: {
          device: {
            type: "string",
            enum: deviceNames,
            description: "Which device to read from",
          },
          path: { type: "string", description: "Absolute file path" },
          max_lines: {
            type: "number",
            description: "Max lines to read (default: 200)",
          },
        },
        required: ["device", "path"],
      },
    });

    tools.push({
      name: "write_file",
      description:
        "Write content to a file on any registered device. Creates parent directories if needed.",
      input_schema: {
        type: "object" as const,
        properties: {
          device: {
            type: "string",
            enum: deviceNames,
            description: "Which device to write to",
          },
          path: { type: "string", description: "Absolute file path" },
          content: { type: "string", description: "File content to write" },
        },
        required: ["device", "path", "content"],
      },
    });
  }

  // transfer_file — only when mesh SSH config exists
  const meshCapable = devices.filter((d) => Object.keys(d.ssh || {}).length > 0);
  if (meshCapable.length > 0 && deviceNames.length >= 2) {
    tools.push({
      name: "transfer_file",
      description:
        "Transfer a file directly between two devices via SCP. " +
        "Requires the source device to have SSH access to the destination. " +
        "Faster than read_file + write_file for large or binary files.",
      input_schema: {
        type: "object" as const,
        properties: {
          from_device: {
            type: "string",
            enum: deviceNames,
            description: "Source device (must have SSH access to dest)",
          },
          to_device: {
            type: "string",
            enum: deviceNames,
            description: "Destination device",
          },
          from_path: { type: "string", description: "Source file path" },
          to_path: { type: "string", description: "Destination file path" },
        },
        required: ["from_device", "to_device", "from_path", "to_path"],
      },
    });
  }

  return tools;
}

/**
 * Map a tool call to its target device (where the command executes).
 */
export function toolToDevice(
  toolName: string,
  input: Record<string, unknown>,
  knownDevices: string[]
): string | null {
  if (toolName.startsWith("run_on_")) {
    const name = toolName.slice("run_on_".length);
    return knownDevices.includes(name) ? name : null;
  }

  if (toolName === "read_file" || toolName === "write_file") {
    const d = input.device;
    if (typeof d === "string" && knownDevices.includes(d)) return d;
    return null;
  }

  if (toolName === "transfer_file") {
    const d = input.from_device;
    if (typeof d === "string" && knownDevices.includes(d)) return d;
    return null;
  }

  return null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildRunDescription(
  device: DeviceWithStatus,
  allDevices: DeviceWithStatus[]
): string {
  const parts: string[] = [
    `Execute a bash command on the "${device.name}" device.`,
  ];
  if (device.os) parts.push(`OS: ${device.os}.`);
  if (device.description) parts.push(device.description);
  if (device.capabilities?.length > 0) {
    parts.push(`Capabilities: ${device.capabilities.join(", ")}.`);
  }

  const reachable = Object.keys(device.ssh || {}).filter((target) =>
    allDevices.some((d) => d.name === target)
  );
  if (reachable.length > 0) {
    parts.push(
      `Can SSH directly to: ${reachable
        .map((r) => `${r} (alias: ${device.ssh[r]})`)
        .join(", ")}.`
    );
  }

  if (!device.online) {
    parts.push("WARNING: This device is currently OFFLINE.");
  }

  return parts.join(" ");
}
