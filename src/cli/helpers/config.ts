import type { YunaConfig, YunaDeviceConfig } from "../../shared/types.js";

/**
 * Config file paths:
 * - Admin config: ~/.config/yuna/config.json (serverUrl, botName, ownerName)
 * - Device config: ~/.config/yuna/device.json (serverUrl, deviceToken, deviceName)
 */

/** TODO: Return XDG_CONFIG_HOME/yuna or ~/.config/yuna */
export function getConfigDir(): string {
  throw new Error("TODO: implement getConfigDir");
}

/** TODO: Read and parse ~/.config/yuna/config.json */
export function loadConfig(): YunaConfig | null {
  throw new Error("TODO: implement loadConfig");
}

/** TODO: Write ~/.config/yuna/config.json (create dir if needed, chmod 600) */
export function saveConfig(_config: YunaConfig): void {
  throw new Error("TODO: implement saveConfig");
}

/** TODO: Read and parse ~/.config/yuna/device.json */
export function loadDeviceConfig(): YunaDeviceConfig | null {
  throw new Error("TODO: implement loadDeviceConfig");
}

/** TODO: Write ~/.config/yuna/device.json (create dir if needed, chmod 600) */
export function saveDeviceConfig(_config: YunaDeviceConfig): void {
  throw new Error("TODO: implement saveDeviceConfig");
}

/** TODO: Return serverUrl from either config.json or device.json */
export function getServerUrl(): string {
  throw new Error("TODO: implement getServerUrl");
}
