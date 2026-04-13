interface TelegramBotInfo {
  id: number;
  username: string;
  firstName: string;
}

export async function validateBotToken(
  token: string
): Promise<TelegramBotInfo | null> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await res.json();
    if (!data.ok) return null;
    return {
      id: data.result.id,
      username: data.result.username,
      firstName: data.result.first_name,
    };
  } catch {
    return null;
  }
}

export async function setWebhook(
  botToken: string,
  webhookUrl: string,
  webhookSecret: string
): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/setWebhook`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: webhookUrl,
          secret_token: webhookSecret,
          allowed_updates: ["message", "message_reaction"],
        }),
      }
    );
    const data = await res.json();
    return data.ok === true;
  } catch {
    return false;
  }
}

export function validateUserId(userId: string): boolean {
  return /^\d+$/.test(userId.trim());
}
