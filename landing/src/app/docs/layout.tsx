import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Docs",
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="container">
      <div className="docs-shell">
        <aside className="docs-sidebar">
          <h4>Getting started</h4>
          <ul>
            <li>
              <Link href="/docs">Overview</Link>
            </li>
            <li>
              <Link href="/docs/install">Install</Link>
            </li>
          </ul>
          <h4>Reference</h4>
          <ul>
            <li>
              <Link href="/docs/architecture">Architecture</Link>
            </li>
            <li>
              <Link href="/docs/commands">Commands</Link>
            </li>
          </ul>
          <h4>Project</h4>
          <ul>
            <li>
              <a
                href="https://github.com/mikevitelli/yuna"
                target="_blank"
                rel="noopener"
              >
                GitHub →
              </a>
            </li>
            <li>
              <a
                href="https://www.npmjs.com/package/yuna-bot"
                target="_blank"
                rel="noopener"
              >
                npm →
              </a>
            </li>
          </ul>
        </aside>
        <article className="docs-content">{children}</article>
      </div>
    </div>
  );
}
