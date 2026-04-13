import type { Metadata } from "next";

const botName = process.env.BOT_NAME || "Yuna";

export const metadata: Metadata = {
  title: `${botName} — AI Device Orchestrator`,
  description: `${botName} is an AI-powered multi-device orchestrator over Telegram.`,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
