import { isIP } from "node:net";
import { resolve } from "node:path";
import { z } from "zod";

const port = z.coerce.number().int().min(1).max(65535);

// An IPv4 or IPv6 address, optionally with a CIDR prefix length. A /0 prefix
// is every address, "trust everything", so it is refused.
function isAddressOrRange(entry: string): boolean {
  const [address = "", prefix, ...rest] = entry.split("/");
  const version = isIP(address);
  if (version === 0 || rest.length > 0) return false;
  if (prefix === undefined) return true;
  return (
    /^\d+$/.test(prefix) &&
    Number(prefix) >= 1 &&
    Number(prefix) <= (version === 4 ? 32 : 128)
  );
}

// The proxies whose X-Forwarded-For entries are believed, by address: "none",
// or a comma-separated list of addresses and ranges. Never a hop count, which
// Fastify ignores, and never "trust everything" (ADR 0025, decision 7).
const trustedProxies = z
  .string()
  .min(1)
  .refine(
    (value) =>
      value === "none" ||
      value.split(",").every((entry) => isAddressOrRange(entry.trim())),
    'must be "none" or a comma-separated list of IP addresses and CIDR ranges',
  )
  .transform((value) =>
    value === "none" ? [] : value.split(",").map((entry) => entry.trim()),
  );

// Every setting is required: a missing one stops startup instead of
// falling back to a default (ADR 0019, decision 2).
const envSchema = z.object({
  HOST: z.string().min(1),
  PORT: port,
  LOG_LEVEL: z.enum([
    "fatal",
    "error",
    "warn",
    "info",
    "debug",
    "trace",
    "silent",
  ]),
  // Separate settings, so ECS can inject the password alone from the
  // RDS-managed secret (ADR 0020, decision 3).
  DATABASE_HOST: z.string().min(1),
  DATABASE_PORT: port,
  DATABASE_NAME: z.string().min(1),
  DATABASE_USER: z.string().min(1),
  DATABASE_PASSWORD: z.string().min(1),
  // The built SPA (ADR 0023, decision 2). A folder that does not exist yet,
  // as in pnpm dev, is not an error: the API logs a warning and serves its
  // own routes only.
  WEB_ROOT: z.string().min(1),
  // In AWS, the VPC's range, where the load balancer lives; "none" locally.
  TRUSTED_PROXIES: trustedProxies,
});

export interface DatabaseSettings {
  host: string;
  port: number;
  name: string;
  user: string;
  password: string;
}

export interface Config {
  host: string;
  port: number;
  logLevel: z.infer<typeof envSchema>["LOG_LEVEL"];
  database: DatabaseSettings;
  // Absolute: a relative WEB_ROOT is resolved against the working directory.
  webRoot: string;
  // Passed to Fastify's trustProxy; empty trusts nothing.
  trustedProxies: string[];
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
  const data = result.data;
  return {
    host: data.HOST,
    port: data.PORT,
    logLevel: data.LOG_LEVEL,
    database: {
      host: data.DATABASE_HOST,
      port: data.DATABASE_PORT,
      name: data.DATABASE_NAME,
      user: data.DATABASE_USER,
      password: data.DATABASE_PASSWORD,
    },
    webRoot: resolve(data.WEB_ROOT),
    trustedProxies: data.TRUSTED_PROXIES,
  };
}
