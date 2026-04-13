/**
 * Inquirer prompt wrappers for the CLI wizard.
 * Provides consistent styling and validation across all prompts.
 */

/** TODO: Prompt for a text input with optional default and validation */
export async function promptText(
  _message: string,
  _options?: { default?: string; validate?: (input: string) => boolean | string }
): Promise<string> {
  // TODO: use inquirer input prompt with chalk-styled message
  throw new Error("TODO: implement promptText");
}

/** TODO: Prompt for a yes/no confirmation */
export async function promptConfirm(
  _message: string,
  _defaultValue?: boolean
): Promise<boolean> {
  // TODO: use inquirer confirm prompt
  throw new Error("TODO: implement promptConfirm");
}

/** TODO: Prompt for a selection from a list */
export async function promptSelect<T extends string>(
  _message: string,
  _choices: { name: string; value: T }[]
): Promise<T> {
  // TODO: use inquirer select prompt
  throw new Error("TODO: implement promptSelect");
}

/** TODO: Prompt for a password/secret (masked input) */
export async function promptSecret(_message: string): Promise<string> {
  // TODO: use inquirer password prompt
  throw new Error("TODO: implement promptSecret");
}
