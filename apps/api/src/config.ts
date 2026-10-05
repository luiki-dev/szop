import { z } from "zod";

// Every setting is required: a missing one stops startup instead of
// falling back to a default (ADR 0019, decision 2).
const envSchema = z.object({
  HOST: z.string().min(1),
  PORT: z.coerce.number().int().min(1).max(65535),
  LOG_LEVEL: z.enum([
    "fatal",
    "error",
    "warn",
    "info",
    "debug",
    "trace",
    "silent",
  ]),
});

export interface Config {
  host: string;
  port: number;
  logLevel: z.infer<typeof envSchema>["LOG_LEVEL"];
}

export function loadConfig(env: Record<string, string | undefined>): Config {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    // Names and Zod's messages only, never the values: they may be secrets.
    const problems = result.error.issues.map((issue) => {
      const name = String(issue.path[0]);
      return env[name] === undefined
        ? `  ${name}: missing`
        : `  ${name}: ${issue.message}`;
    });
    throw new Error(`Invalid configuration:\n${problems.join("\n")}`);
  }
  const { HOST, PORT, LOG_LEVEL } = result.data;
  return { host: HOST, port: PORT, logLevel: LOG_LEVEL };
}
