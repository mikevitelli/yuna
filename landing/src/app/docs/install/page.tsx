import type { Metadata } from "next";

export const metadata: Metadata = { title: "Install" };

export default function InstallDoc() {
  return (
    <>
      <h1>Install</h1>
      <p>
        From a fresh machine, setup takes about 5 minutes. The wizard walks
        you through every service and validates each credential as you paste
        it.
      </p>

      <h2>1. Run the wizard</h2>
      <pre>
        <code>{`# One-shot (no global install)
npx yuna-bot init

# Or install globally
npm install -g yuna-bot
yuna init`}</code>
      </pre>
      <p>The wizard will:</p>
      <ol>
        <li>
          Ask what to call your bot (you pick — <code>Luigi</code>,{" "}
          <code>Jarvis</code>, <code>Alfred</code>, whatever).
        </li>
        <li>
          Open <a href="https://t.me/BotFather">@BotFather</a> in your browser
          and prompt for a bot token. The token is validated via{" "}
          <code>getMe</code> before the wizard continues.
        </li>
        <li>Ask for your Telegram user ID (via @userinfobot).</li>
        <li>
          Open <a href="https://console.anthropic.com/settings/keys">
            console.anthropic.com
          </a>{" "}
          and prompt for an API key.
        </li>
        <li>
          Open <a href="https://console.upstash.com">console.upstash.com</a>{" "}
          and prompt for a Redis REST URL + token. Create a fresh database —
          don&apos;t share with any other project.
        </li>
        <li>
          Deploy the bundled server template to Vercel via{" "}
          <code>vercel link</code> + <code>vercel deploy --prod</code>, or
          scaffold it locally if you pass <code>--manual</code>.
        </li>
        <li>
          Hash the master secret into Redis, register the Telegram webhook,
          and save <code>~/.config/yuna/config.json</code>.
        </li>
      </ol>

      <blockquote>
        Every answer you give the wizard is persisted to{" "}
        <code>~/.config/yuna/.init-resume.json</code> (chmod 600) as you go.
        If the deploy step fails, re-run <code>yuna init</code> and the wizard
        will offer to resume — no re-entering secrets.
      </blockquote>

      <h2>2. Prerequisites</h2>
      <ul>
        <li>
          <strong>Node 18+</strong> (20+ recommended for Vercel CLI).
        </li>
        <li>
          <strong>Vercel CLI</strong> installed and logged in.{" "}
          <code>npm i -g vercel</code> then <code>vercel login</code>. The
          wizard will detect a missing CLI before asking for any secrets and
          tell you how to install it.
        </li>
        <li>
          <strong>Browser access</strong> — for one-time auth flows against
          BotFather, Anthropic, Upstash, and Vercel. If you&apos;re on a
          headless box, pass the service credentials you already have.
        </li>
      </ul>

      <h2>3. Disable Vercel deployment protection</h2>
      <p>
        By default, brand-new Vercel projects have SSO-based deployment
        protection turned on, which bounces Telegram&apos;s webhook off an
        authentication wall. Go to{" "}
        <code>Settings → Deployment Protection</code> in your new project and
        set both <strong>Vercel Authentication</strong> and{" "}
        <strong>Protection for Deployment URLs</strong> to{" "}
        <strong>Disabled</strong>. The webhook is already authenticated by a
        <code>TELEGRAM_WEBHOOK_SECRET</code> header check in code.
      </p>
      <p>
        This is a one-time step and Yuna will detect it automatically in a
        future release.
      </p>

      <h2>4. Register a device</h2>
      <p>
        Once the server is live, add a device. On any machine you want to
        expose:
      </p>
      <pre>
        <code>{`# 1. From Telegram, send /create-code to your bot
#    → copy the code (e.g. ABCD-1234)

# 2. On the new device
npm install -g yuna-bot
yuna add-device --code ABCD-1234 --url https://your-app.vercel.app

# 3. Start the agent (foreground)
yuna start`}</code>
      </pre>
      <p>
        The agent long-polls <code>/api/relay/poll</code> and executes any
        commands it receives. Leave it running, or put it under systemd /
        launchd for unattended operation.
      </p>

      <h2>5. Say hi</h2>
      <p>From Telegram, try:</p>
      <pre>
        <code>{`/start
/status
what time is it
check my disk usage
@opus explain how this works`}</code>
      </pre>
      <p>
        First ones answer directly, the disk command routes to your device via
        tool_use. See <a href="/docs/commands">commands</a> for the full list.
      </p>
    </>
  );
}
