import inquirer from "inquirer";

export async function promptText(
  message: string,
  options: {
    default?: string;
    validate?: (input: string) => boolean | string;
  } = {}
): Promise<string> {
  const { value } = await inquirer.prompt<{ value: string }>([
    {
      type: "input",
      name: "value",
      message,
      default: options.default,
      validate: options.validate,
    },
  ]);
  return value.trim();
}

export async function promptConfirm(
  message: string,
  defaultValue: boolean = true
): Promise<boolean> {
  const { value } = await inquirer.prompt<{ value: boolean }>([
    {
      type: "confirm",
      name: "value",
      message,
      default: defaultValue,
    },
  ]);
  return value;
}

export async function promptSelect<T extends string>(
  message: string,
  choices: { name: string; value: T }[]
): Promise<T> {
  const { value } = await inquirer.prompt<{ value: T }>([
    {
      type: "list",
      name: "value",
      message,
      choices,
    },
  ]);
  return value;
}

export async function promptSecret(message: string): Promise<string> {
  const { value } = await inquirer.prompt<{ value: string }>([
    {
      type: "password",
      name: "value",
      message,
      mask: "*",
    },
  ]);
  return value.trim();
}
