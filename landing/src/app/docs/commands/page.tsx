import type { Metadata } from "next";

export const metadata: Metadata = { title: "Commands" };

export default function CommandsDoc() {
  return (
    <>
      <h1>Commands</h1>
      <p>
        Yuna has two command surfaces: the local CLI (<code>yuna</code>) for
        setup and device management, and Telegram slash-commands for runtime
        control. Most day-to-day operation happens via plain Telegram messages
        — you only touch the CLI once per device.
      </p>

      <h2>CLI</h2>
      <table>
        <thead>
          <tr>
            <th>Command</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>yuna init</code>
            </td>
            <td>
              Interactive wizard: deploy server to Vercel, configure Telegram
              + Anthropic + Upstash, save local config
            </td>
          </tr>
          <tr>
            <td>
              <code>yuna init --manual</code>
            </td>
            <td>
              Scaffold the server to <code>./yuna-server/</code> instead of
              auto-deploying
            </td>
          </tr>
          <tr>
            <td>
              <code>yuna add-device --code X --url Y</code>
            </td>
            <td>
              Register this machine as a device using a one-time setup code
              from Telegram
            </td>
          </tr>
          <tr>
            <td>
              <code>yuna start</code>
            </td>
            <td>
              Run the device agent in the foreground. Long-polls for commands
              and executes them.
            </td>
          </tr>
          <tr>
            <td>
              <code>yuna status</code>
            </td>
            <td>Server health check + online/offline device list</td>
          </tr>
          <tr>
            <td>
              <code>yuna reset</code>
            </td>
            <td>Pointer to <code>/reset</code> on Telegram</td>
          </tr>
          <tr>
            <td>
              <code>yuna create-code</code>
            </td>
            <td>Pointer to <code>/create-code</code> on Telegram</td>
          </tr>
          <tr>
            <td>
              <code>yuna revoke-device &lt;name&gt;</code>
            </td>
            <td>Pointer to <code>/revoke</code> on Telegram</td>
          </tr>
          <tr>
            <td>
              <code>yuna logs</code>
            </td>
            <td>Pointer to <code>/logs</code> on Telegram</td>
          </tr>
          <tr>
            <td>
              <code>yuna --help</code>
            </td>
            <td>All of the above</td>
          </tr>
        </tbody>
      </table>

      <h2>Telegram</h2>
      <p>
        Send any of these as a message to your bot. Slash-commands are
        instant; plain-text messages go through Claude and may dispatch tool
        calls to your devices.
      </p>

      <h3>Slash-commands</h3>
      <table>
        <thead>
          <tr>
            <th>Command</th>
            <th>What it does</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>/start</code>
            </td>
            <td>Welcome message and command reference</td>
          </tr>
          <tr>
            <td>
              <code>/status</code>
            </td>
            <td>Device list with 🟢/🔴 online status and last heartbeat</td>
          </tr>
          <tr>
            <td>
              <code>/reset</code>
            </td>
            <td>Clear conversation history</td>
          </tr>
          <tr>
            <td>
              <code>/create-code</code>
            </td>
            <td>
              Generate a one-time device setup code (10-min TTL, single-use)
            </td>
          </tr>
          <tr>
            <td>
              <code>/revoke &lt;name&gt;</code>
            </td>
            <td>
              Revoke a device&apos;s token (instant — the Redis key is deleted)
            </td>
          </tr>
          <tr>
            <td>
              <code>/logs</code>
            </td>
            <td>Last 20 audit log entries (commands + errors)</td>
          </tr>
        </tbody>
      </table>

      <h3>Model overrides</h3>
      <p>Prefix any message to pick the model for that turn:</p>
      <table>
        <thead>
          <tr>
            <th>Prefix</th>
            <th>Model</th>
            <th>Rough cost</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>@haiku</code> (default)
            </td>
            <td>Claude Haiku 4.5</td>
            <td>~$0.001/msg</td>
          </tr>
          <tr>
            <td>
              <code>@sonnet</code>
            </td>
            <td>Claude Sonnet 4.6</td>
            <td>~$0.01/msg</td>
          </tr>
          <tr>
            <td>
              <code>@opus</code>
            </td>
            <td>Claude Opus 4.6</td>
            <td>~$0.05/msg</td>
          </tr>
        </tbody>
      </table>
      <pre>
        <code>{`@opus explain why my build is failing
@sonnet draft a changelog for v0.2
what's 2+2       # → direct answer, no tools, Haiku`}</code>
      </pre>

      <h3>Emoji reactions</h3>
      <p>
        React to any message Yuna sent to drive the next turn without typing.
        For risky-command confirmations, 👍 approves and ❌ cancels.
      </p>
      <table>
        <thead>
          <tr>
            <th>Emoji</th>
            <th>Meaning</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>👍 / ❤️ / ✅ / 🚀</td>
            <td>Yes, proceed / confirm / ship it</td>
          </tr>
          <tr>
            <td>👎 / ❌</td>
            <td>No, stop / cancel / revert</td>
          </tr>
          <tr>
            <td>🔄</td>
            <td>Retry the previous action</td>
          </tr>
        </tbody>
      </table>

      <h3>Natural-language examples</h3>
      <pre>
        <code>{`check my battery                 # routes to the right device
clean up /tmp on the laptop      # triggers the risk gate
copy build.tgz from mac to pi    # uses transfer_file if mesh-configured
what's the load avg everywhere   # parallel tool use across devices
@opus debug this stack trace ... # one-off model override`}</code>
      </pre>
    </>
  );
}
