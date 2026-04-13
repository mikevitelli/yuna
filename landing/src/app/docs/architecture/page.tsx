import type { Metadata } from "next";

export const metadata: Metadata = { title: "Architecture" };

export default function ArchitectureDoc() {
  return (
    <>
      <h1>Architecture</h1>
      <p>
        Yuna is pull-based, stateless, and fire-and-forget. The orchestrator
        never opens a connection to your device. Communication flows through{" "}
        <strong>Redis Streams</strong> as a broker and{" "}
        <strong>long-poll HTTPS</strong> as pseudo-push. This is the same
        pattern GitHub Actions runners and Celery workers use — it just
        happens to be wrapped around a Claude agent loop.
      </p>

      <h2>The end-to-end flow</h2>
      <div className="arch">
        <pre>{`
    Telegram                    Vercel                     Redis                   Device
    ────────                    ──────                     ─────                   ──────
    user msg  ─── webhook ───▶  orchestrator
                                   │
                                   ├─▶ Claude API (tool_use)
                                   │
                                   │◀── tool_use: run_on_{dev}
                                   │
                                   ├─── risk gate ─── risky? ─── Telegram ⚠️
                                   │                              (await 👍/❌)
                                   │
                                   └─── XADD ───────▶  stream:{dev}
                                                          │
                                                          │◀─── XREADGROUP (long-poll, 25s)
                                                          │
                                                                                    device
                                                                                    executes
                                                                                    bash
                                   ┌────── POST /respond ◀─────────────────────────── output
                                   │
                                   ├─▶ Claude API (tool_result)
                                   │
                                   │◀── final text
                                   │
    reply    ◀── sendMessage ───  ┘
`.trim()}</pre>
      </div>

      <h2>Components</h2>

      <h3>Server (Next.js on Vercel)</h3>
      <ul>
        <li>
          <code>lib/orchestrator.ts</code> — the Claude agent loop. Holds the
          conversation, builds tools dynamically, dispatches commands,
          resumes on tool_result.
        </li>
        <li>
          <code>lib/tools.ts</code> — generates <code>run_on_&#123;device&#125;</code>,{" "}
          <code>read_file</code>, <code>write_file</code>, and (conditionally){" "}
          <code>transfer_file</code> tool definitions from the device registry
          on every Claude call.
        </li>
        <li>
          <code>lib/system-prompt.ts</code> — builds a dynamic system prompt
          with one section per registered device (status, OS, description,
          capabilities). Tells the model that <code>&lt;tool_output&gt;</code>{" "}
          content is untrusted.
        </li>
        <li>
          <code>lib/risk.ts</code> — regex classifier for destructive commands
          (rm -rf, dd, sudo, force-push, mkfs, eval, etc.). Flags go through
          the confirmation gate.
        </li>
        <li>
          <code>lib/redis.ts</code> — typed helpers over Upstash Redis for
          streams, conversation, orchestration tasks, audit log, pending
          confirmations.
        </li>
        <li>
          <code>lib/devices.ts</code> — device registry CRUD with online
          status (heartbeat window 60s).
        </li>
        <li>
          <code>lib/auth.ts</code> — per-device UUID tokens, one-time setup
          codes, hashed master secret, Telegram owner lock.
        </li>
        <li>
          API routes: <code>/api/telegram/webhook</code>,{" "}
          <code>/api/relay/poll</code>, <code>/api/relay/respond</code>,{" "}
          <code>/api/relay/register</code>, <code>/api/devices</code>,{" "}
          <code>/api/health</code>.
        </li>
      </ul>

      <h3>Device agent</h3>
      <ul>
        <li>
          <code>agent.ts</code> — polling loop. Long-polls{" "}
          <code>/api/relay/poll</code> with a per-fetch AbortController to
          avoid leaking listeners on the shutdown signal. Exponential backoff
          on network failure (1s → 30s cap).
        </li>
        <li>
          <code>executor.ts</code> — bash / read_file / write_file /
          transfer_file. Per-command timeout (default 60s, max configurable
          via <code>timeout_seconds</code> in the tool input). Output
          truncated at 8 KB with head+tail preservation.
        </li>
        <li>
          Runs on any Linux or macOS box with Node 18+. Only needs outbound
          HTTPS to your Vercel URL — no inbound ports, no Tailscale required.
        </li>
      </ul>

      <h2>Redis keys</h2>
      <table>
        <thead>
          <tr>
            <th>Key</th>
            <th>Type</th>
            <th>Purpose</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>yuna:devices</code>
            </td>
            <td>SET</td>
            <td>Registered device names</td>
          </tr>
          <tr>
            <td>
              <code>yuna:device:&#123;name&#125;</code>
            </td>
            <td>HASH</td>
            <td>Device metadata (os, description, capabilities, ssh)</td>
          </tr>
          <tr>
            <td>
              <code>yuna:token:&#123;token&#125;</code>
            </td>
            <td>STRING</td>
            <td>Per-device auth token → device identity</td>
          </tr>
          <tr>
            <td>
              <code>yuna:device-token:&#123;name&#125;</code>
            </td>
            <td>STRING</td>
            <td>Reverse index for token revocation</td>
          </tr>
          <tr>
            <td>
              <code>yuna:setup-code:&#123;code&#125;</code>
            </td>
            <td>STRING</td>
            <td>One-time device setup code (10-min TTL)</td>
          </tr>
          <tr>
            <td>
              <code>yuna:lastseen:&#123;name&#125;</code>
            </td>
            <td>STRING</td>
            <td>Device heartbeat timestamp</td>
          </tr>
          <tr>
            <td>
              <code>yuna:stream:&#123;name&#125;</code>
            </td>
            <td>STREAM</td>
            <td>
              Per-device command queue, consumer group <code>agent</code>
            </td>
          </tr>
          <tr>
            <td>
              <code>yuna:conversation:messages</code>
            </td>
            <td>STRING</td>
            <td>Shared conversation history (JSON)</td>
          </tr>
          <tr>
            <td>
              <code>yuna:orchestration:&#123;taskId&#125;</code>
            </td>
            <td>STRING</td>
            <td>In-flight agentic task state (5-min TTL)</td>
          </tr>
          <tr>
            <td>
              <code>yuna:pending-confirm:&#123;msgId&#125;</code>
            </td>
            <td>STRING</td>
            <td>Risky command awaiting 👍/❌ reaction (5-min TTL)</td>
          </tr>
          <tr>
            <td>
              <code>yuna:log</code>
            </td>
            <td>LIST</td>
            <td>Audit log, capped at 1000 entries</td>
          </tr>
          <tr>
            <td>
              <code>yuna:master</code>
            </td>
            <td>STRING</td>
            <td>Hashed master secret</td>
          </tr>
        </tbody>
      </table>

      <h2>Wire protocol</h2>
      <p>
        The orchestrator serializes a command to the device stream as a flat
        field map (Redis Streams don&apos;t support nesting):
      </p>
      <pre>
        <code>{`{
  "type": "command",
  "taskId": "uuid",
  "tool": "run_on_uconsole",
  "input": "{\\"command\\":\\"df -h\\",\\"timeout_seconds\\":60}",
  "chatId": "123456",
  "messageId": "42",
  "payload": "...",
  "timestamp": "2026-04-13T03:30:00.000Z"
}`}</code>
      </pre>
      <p>The device responds via POST:</p>
      <pre>
        <code>{`POST /api/relay/respond
Authorization: Bearer <device-token>

{
  "taskId": "uuid",
  "output": "<bash stdout+stderr>",
  "exitCode": 0,
  "streamId": "1234567890-0"
}`}</code>
      </pre>
      <p>
        The orchestrator then ACKs the stream entry, appends the output to the
        orchestration task (wrapped in <code>&lt;tool_output&gt;</code>{" "}
        delimiters), and feeds the batch back to Claude as{" "}
        <code>tool_result</code> blocks.
      </p>

      <h2>Why this architecture</h2>
      <ul>
        <li>
          <strong>Devices are stateless and firewall-friendly.</strong> They
          only make outbound HTTPS. No VPN, no port forwarding, no Tailscale
          required. Works from coffee shops and cell data without any extra
          setup.
        </li>
        <li>
          <strong>The server is stateless too.</strong> Every request to Vercel
          loads conversation + orchestration state from Redis, does its work,
          and returns. Vercel can scale to zero between invocations — you only
          pay for actual traffic.
        </li>
        <li>
          <strong>Redis Streams give guaranteed delivery.</strong> Consumer
          groups with XACK mean a command is either processed or reclaimed if
          the device crashes mid-execution. No silent drops.
        </li>
        <li>
          <strong>Dynamic tools mean zero code changes per device.</strong>{" "}
          Adding a device is a runtime operation. Claude&apos;s tool list is
          regenerated from the registry on every call, and the system prompt
          describes each device so the model can route intelligently.
        </li>
      </ul>
    </>
  );
}
