// Risk classifier for tool calls. Gates destructive commands behind
// user confirmation to defend against prompt-injection attacks where
// tool output (file contents, command stdout) convinces the model
// to execute dangerous follow-up commands.
//
// Philosophy: err on the side of asking. A prompt is cheap; an rm -rf is not.

export interface RiskAssessment {
  risky: boolean;
  reason?: string;
  summary: string; // short description for the confirmation prompt
}

const DESTRUCTIVE_PATTERNS: Array<[RegExp, string]> = [
  [/\brm\s+(?:-[a-zA-Z]*[rRf][a-zA-Z]*|--recursive|--force)/, "recursive/force delete"],
  [/\bdd\s+(?:[a-z]+=|if=|of=)/, "dd (raw disk write)"],
  [/\bmkfs\b/, "filesystem format"],
  [/\b(?:curl|wget|fetch)\b[^|;&]*\|\s*(?:bash|sh|zsh|fish|python|perl|ruby|node)\b/, "pipe remote content to interpreter"],
  [/\bchmod\s+-R\b/, "recursive chmod"],
  [/\bchown\s+-R\b/, "recursive chown"],
  [/\b(?:sudo|doas)\b/, "privilege escalation (sudo)"],
  [/\bsu\s+-?\s*(?:\w+)?\s*$/, "user switch (su)"],
  [/\bshutdown\b/, "system shutdown"],
  [/\breboot\b/, "system reboot"],
  [/\bhalt\b/, "system halt"],
  [/\bpoweroff\b/, "system poweroff"],
  [/\bsystemctl\s+(?:stop|disable|mask|kill)\b/, "systemctl stop/disable"],
  [/\bservice\s+\S+\s+(?:stop|disable)\b/, "service stop/disable"],
  [/\bkill\s+-9\b/, "kill -9"],
  [/\bkillall\s+-9\b/, "killall -9"],
  [/\bpkill\s+-9\b/, "pkill -9"],
  [/\bgit\s+push[^;]*--force/, "git force-push"],
  [/\bgit\s+push[^;]*\s-f(?:\s|$)/, "git force-push"],
  [/\bgit\s+reset\s+--hard\b/, "git reset --hard"],
  [/\bgit\s+clean\s+-[a-z]*f/, "git clean -f"],
  [/\bnpm\s+publish\b/, "npm publish"],
  [/\bdocker\s+(?:rm|rmi|system\s+prune|volume\s+rm)\b/, "docker delete"],
  [/\bkubectl\s+delete\b/, "kubectl delete"],
  [/\bterraform\s+destroy\b/, "terraform destroy"],
  [/>\s*\/dev\/sd[a-z]/, "write to raw disk device"],
  [/>\s*\/etc\/\S+/, "overwrite /etc file"],
  [/>\s*\/boot\/\S+/, "overwrite /boot file"],
  [/:\s*\(\s*\)\s*\{[^}]*\}\s*;\s*:/, "fork bomb"],
  [/\beval\s+["$']/, "eval"],
  [/\bsource\s+<\(/, "source process substitution"],
  [/\bbase64\s+-d[^|]*\|\s*(?:bash|sh|python)/, "base64 decode pipe to interpreter"],
];

export function classifyToolCall(
  toolName: string,
  input: Record<string, unknown>
): RiskAssessment {
  // read_file is always safe
  if (toolName === "read_file") {
    const path = typeof input.path === "string" ? input.path : "?";
    return { risky: false, summary: `read_file ${path}` };
  }

  // write_file is always risky — any write can clobber important state
  if (toolName === "write_file") {
    const path = typeof input.path === "string" ? input.path : "?";
    return {
      risky: true,
      reason: "file write",
      summary: `write_file ${path}`,
    };
  }

  // transfer_file: destination write = risky
  if (toolName === "transfer_file") {
    const to = typeof input.to_device === "string" ? input.to_device : "?";
    const destPath =
      typeof input.dest_path === "string" ? input.dest_path : "?";
    return {
      risky: true,
      reason: "cross-device file transfer",
      summary: `transfer_file → ${to}:${destPath}`,
    };
  }

  // run_on_*: inspect the command string
  if (toolName.startsWith("run_on_")) {
    const command = typeof input.command === "string" ? input.command : "";
    const summary = command.slice(0, 200) || "(empty command)";
    for (const [pattern, reason] of DESTRUCTIVE_PATTERNS) {
      if (pattern.test(command)) {
        return { risky: true, reason, summary };
      }
    }
    return { risky: false, summary };
  }

  // Unknown tool — gate by default
  return {
    risky: true,
    reason: `unknown tool "${toolName}"`,
    summary: toolName,
  };
}
