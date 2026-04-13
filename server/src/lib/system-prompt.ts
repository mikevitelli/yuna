/**
 * Dynamic system prompt generation from the device registry.
 *
 * Builds a system prompt that describes all registered devices,
 * their capabilities, OS, online/offline status, and SSH reachability.
 */

/**
 * TODO: Build the system prompt from the device registry.
 *
 * The prompt should include:
 * 1. Bot identity section (BOT_NAME and OWNER_NAME from env)
 * 2. Per-device section for each registered device:
 *    - Device name, OS, description
 *    - Capabilities list
 *    - Online/offline status
 *    - SSH reachability (which other devices it can reach)
 * 3. General instructions for tool use
 * 4. Conversation guidelines
 *
 * Reads BOT_NAME and OWNER_NAME from process.env.
 * Fetches device list from Redis via devices.ts.
 */
export async function buildSystemPrompt(): Promise<string> {
  // TODO:
  // 1. Fetch all devices with status from devices.ts
  // 2. Build identity section from env vars
  // 3. Build device sections dynamically
  // 4. Add tool usage instructions
  // 5. Return complete prompt string
  throw new Error("TODO: implement buildSystemPrompt");
}
