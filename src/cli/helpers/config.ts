import { readFileSync, writeFileSync, mkdirSync, chmodSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { YunaConfig, YunaDeviceConfig } from "../../shared/types.js";

export function getConfigDir(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  return xdg ? join(xdg, "yuna") : join(homedir(), ".config", "yuna");
}

function getConfigPath(): string {
  return join(getConfigDir(), "config.json");
}

function getDevicePath(): string {
  return join(getConfigDir(), "device.json");
}

function ensureDir(): void {
  const dir = getConfigDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
}

// ─── Admin config ────────────────────────────────────────────────────────────

export function loadConfig(): YunaConfig | null {
  const path = getConfigPath();
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as YunaConfig;
  } catch {
    return null;
  }
}

export function saveConfig(config: YunaConfig): void {
  ensureDir();
  const path = getConfigPath();
  writeFileSync(path, JSON.stringify(config, null, 2));
  chmodSync(path, 0o600);
}

// ─── Device config ───────────────────────────────────────────────────────────

export function loadDeviceConfig(): YunaDeviceConfig | null {
  const path = getDevicePath();
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as YunaDeviceConfig;
  } catch {
    return null;
  }
}

export function saveDeviceConfig(config: YunaDeviceConfig): void {
  ensureDir();
  const path = getDevicePath();
  writeFileSync(path, JSON.stringify(config, null, 2));
  chmodSync(path, 0o600);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getServerUrl(): string {
  const config = loadConfig();
  if (config?.serverUrl) return config.serverUrl;
  const device = loadDeviceConfig();
  if (device?.serverUrl) return device.serverUrl;
  throw new Error(
    "No Yuna config found. Run `yuna init` or `yuna add-device --code <code>` first."
  );
}
