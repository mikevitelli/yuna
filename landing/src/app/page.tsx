import Link from "next/link";

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="container">
          <h1>Yuna</h1>
          <p className="hero-tagline">
            Self-hosted AI-powered multi-device orchestrator over Telegram.
            Claude picks the right device and runs the command — devices are
            just hands. You pick the character.
          </p>
          <div>
            <code className="hero-install">npx yuna-bot init</code>
          </div>
          <div className="hero-cta">
            <Link href="/docs/install" className="btn btn-primary">
              Get started
            </Link>
            <a
              href="https://github.com/mikevitelli/yuna"
              target="_blank"
              rel="noopener"
              className="btn btn-secondary"
            >
              GitHub
            </a>
          </div>
          <div className="badges">
            <span className="badge">Vercel</span>
            <span className="badge">Claude Haiku</span>
            <span className="badge">Upstash Redis</span>
            <span className="badge">Telegram</span>
            <span className="badge">Node 18+</span>
          </div>
        </div>
      </section>

      <section className="container">
        <h2>Send a message. Claude does the rest.</h2>
        <p>
          You message your bot on Telegram. A Claude agent on your Vercel
          function decides what to do — answer directly, or dispatch bash
          commands to one of your registered devices via Redis Streams. Devices
          are stateless long-poll agents behind any NAT or firewall. No VPN, no
          Tailscale, no port forwarding.
        </p>

        <div className="features">
          <div className="feature">
            <h3>Dynamic device registry</h3>
            <p>
              Add or remove devices at runtime. Tools are generated on the fly
              from whatever's in your Redis — no hardcoding.
            </p>
          </div>
          <div className="feature">
            <h3>Agentic tool_use</h3>
            <p>
              Multi-step loops: Claude can chain commands across devices and
              react to failure. &quot;Grab the log from A, diff against B,
              deploy.&quot;
            </p>
          </div>
          <div className="feature">
            <h3>Per-device auth</h3>
            <p>
              Every device gets its own revocable UUID token. One-time setup
              codes for onboarding. No shared secrets.
            </p>
          </div>
          <div className="feature">
            <h3>Risk gate</h3>
            <p>
              Destructive commands (rm -rf, dd, sudo, force-push, writes) are
              held behind a 👍/❌ confirmation in Telegram. Defends against
              prompt injection via tool output.
            </p>
          </div>
          <div className="feature">
            <h3>Model overrides</h3>
            <p>
              Prefix a message with <code>@opus</code>, <code>@sonnet</code>,
              or <code>@haiku</code> to pick the model per request. Haiku by
              default — about $0.001 per message.
            </p>
          </div>
          <div className="feature">
            <h3>100% self-hosted</h3>
            <p>
              Your Vercel, your Upstash, your Anthropic key, your Telegram bot.
              No SaaS middleman. Your conversation history never leaves
              infrastructure you own.
            </p>
          </div>
        </div>

        <h2>How it works</h2>
        <div className="arch">
          <pre>{`
   Telegram message
         ↓
   Vercel webhook  ─────────→  Claude Haiku API
         ↓                      (tool_use loop)
   Risk gate + pending-confirm
         ↓
   Redis Streams (per-device queue)
         ↓
   Device agent (long-polls, executes bash, returns output)
         ↓
   Result fed back to Claude → final answer → Telegram
`.trim()}</pre>
        </div>

        <h2>Install</h2>
        <pre>
          <code>{`# One-shot wizard — guides you through Telegram, Anthropic,
# Upstash, and Vercel setup in about 5 minutes.
npx yuna-bot init

# Register this machine as a device
yuna add-device --code ABCD-1234

# Run the agent
yuna start`}</code>
        </pre>
        <p>
          See the <Link href="/docs/install">full install guide</Link> or jump
          to <Link href="/docs/architecture">architecture</Link>.
        </p>

        <h2>Typical cost</h2>
        <p>
          Running Yuna for personal use on the free tiers of Vercel and Upstash
          costs{" "}
          <strong style={{ color: "var(--fg)" }}>under $5/month</strong> even
          with heavy daily use — Haiku is about $0.001 per direct answer and
          about $0.005 for multi-step tool use.
        </p>

        <hr />

        <p style={{ textAlign: "center", color: "var(--fg-3)" }}>
          Yuna is MIT-licensed and open source.{" "}
          <a
            href="https://github.com/mikevitelli/yuna"
            target="_blank"
            rel="noopener"
          >
            Read the source
          </a>
          .
        </p>
      </section>
    </>
  );
}
