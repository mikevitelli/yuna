import { Command } from "commander";
import { registerInit } from "./init.js";
import { registerAddDevice } from "./add-device.js";
import { registerStart } from "./start.js";
import { registerStatus } from "./status.js";
import { registerReset } from "./reset.js";
import { registerCreateCode } from "./create-code.js";
import { registerRevokeDevice } from "./revoke-device.js";
import { registerLogs } from "./logs.js";

const program = new Command();

program
  .name("yuna")
  .description("AI-powered multi-device orchestrator over Telegram")
  .version("0.1.0");

registerInit(program);
registerAddDevice(program);
registerStart(program);
registerStatus(program);
registerReset(program);
registerCreateCode(program);
registerRevokeDevice(program);
registerLogs(program);

program.parse();
