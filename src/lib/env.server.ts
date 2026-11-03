import "server-only";
import { parseEnv, serverSchema, type ServerEnv } from "./env";

let cached: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  cached ??= parseEnv(serverSchema, process.env);
  return cached;
}
