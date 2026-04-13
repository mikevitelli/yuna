import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://yuna.bot"),
  title: {
    default: "Yuna — self-hosted AI device orchestrator",
    template: "%s · Yuna",
  },
  description:
    "Self-hosted AI-powered multi-device orchestrator over Telegram. Claude picks the right device and runs the command — devices are just hands.",
  keywords: [
    "telegram",
    "claude",
    "anthropic",
    "ai agent",
    "self-hosted",
    "multi-device",
    "orchestrator",
    "vercel",
    "upstash",
  ],
  authors: [{ name: "mikevitelli" }],
  openGraph: {
    title: "Yuna",
    description:
      "Self-hosted AI-powered multi-device orchestrator over Telegram.",
    url: "https://yuna.bot",
    siteName: "Yuna",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Yuna",
    description:
      "Self-hosted AI-powered multi-device orchestrator over Telegram.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <nav className="nav">
          <div className="nav-inner">
            <Link href="/" className="nav-brand">
              Yuna
            </Link>
            <ul className="nav-links">
              <li>
                <Link href="/docs">Docs</Link>
              </li>
              <li>
                <a
                  href="https://www.npmjs.com/package/yuna-bot"
                  target="_blank"
                  rel="noopener"
                >
                  npm
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/mikevitelli/yuna"
                  target="_blank"
                  rel="noopener"
                >
                  GitHub
                </a>
              </li>
            </ul>
          </div>
        </nav>
        {children}
        <footer className="footer">
          <div className="footer-inner">
            <span>MIT · yuna-bot</span>
            <span>
              <a
                href="https://github.com/mikevitelli/yuna"
                target="_blank"
                rel="noopener"
              >
                github
              </a>
              {" · "}
              <a
                href="https://www.npmjs.com/package/yuna-bot"
                target="_blank"
                rel="noopener"
              >
                npm
              </a>
              {" · "}
              <Link href="/docs">docs</Link>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
