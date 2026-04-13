import open from "open";

export async function openInBrowser(url: string): Promise<void> {
  try {
    await open(url);
  } catch {
    // Headless or no browser — fail silently, caller should print URL
  }
}
