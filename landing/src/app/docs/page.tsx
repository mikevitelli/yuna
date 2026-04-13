import Link from "next/link";

export default function DocsIndex() {
  return (
    <>
      <h1>Yuna docs</h1>
      <p>
        Yuna is an npm CLI (<code>yuna-bot</code>) and a bundled Next.js server
        that, together, let you deploy an AI-powered Telegram orchestrator for
        your personal device fleet. The wizard walks you through Telegram,
        Anthropic, Upstash, and Vercel setup, deploys a serverless function to
        your Vercel account, and hands you a bot you can message from
        anywhere.
      </p>

      <h2>Start here</h2>
      <ul>
        <li>
          <Link href="/docs/install">Install</Link> — end-to-end setup in about
          5 minutes.
        </li>
        <li>
          <Link href="/docs/architecture">Architecture</Link> — how the
          webhook, orchestrator, Redis Streams, and device agent fit together.
        </li>
        <li>
          <Link href="/docs/commands">Commands</Link> — every CLI subcommand
          and every Telegram slash-command.
        </li>
      </ul>

      <h2>What you&apos;ll need</h2>
      <table>
        <thead>
          <tr>
            <th>Service</th>
            <th>Why</th>
            <th>Cost</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noopener"
              >
                Telegram bot
              </a>
            </td>
            <td>Your chat interface</td>
            <td>Free</td>
          </tr>
          <tr>
            <td>
              <a
                href="https://console.anthropic.com"
                target="_blank"
                rel="noopener"
              >
                Anthropic API key
              </a>
            </td>
            <td>Claude Haiku by default</td>
            <td>~$0.001/msg</td>
          </tr>
          <tr>
            <td>
              <a
                href="https://console.upstash.com"
                target="_blank"
                rel="noopener"
              >
                Upstash Redis
              </a>
            </td>
            <td>Queues, conversation, audit log</td>
            <td>Free tier: 10k cmds/day</td>
          </tr>
          <tr>
            <td>
              <a href="https://vercel.com" target="_blank" rel="noopener">
                Vercel
              </a>
            </td>
            <td>Server hosting</td>
            <td>Free tier: 100k invocations/mo</td>
          </tr>
        </tbody>
      </table>

      <p>
        Typical cost for personal use:{" "}
        <strong style={{ color: "var(--fg)" }}>under $5/month</strong> with
        Haiku, even heavy daily use.
      </p>

      <blockquote>
        Yuna is self-hosted. There is no SaaS — you run your own Vercel
        instance, bring your own API keys, and nothing is shared with anyone.
        Your conversation history lives in infrastructure you control.
      </blockquote>
    </>
  );
}
