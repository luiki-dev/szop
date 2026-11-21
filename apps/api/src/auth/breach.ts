import { createHash } from "node:crypto";
import type { FastifyBaseLogger } from "fastify";

// Whether the password is in Have I Been Pwned's list of leaked passwords,
// asked by k-anonymity: only the first 5 characters of its SHA-1 hash leave
// the server, and the match is made here. Any failure accepts the password
// (ACC-2.4); the one warning names no password, hash or prefix.
export async function isBreached(
  password: string,
  log: Pick<FastifyBaseLogger, "warn">,
  fetchFn: typeof fetch = fetch,
): Promise<boolean> {
  const hash = createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  try {
    const response = await fetchFn(
      `https://api.pwnedpasswords.com/range/${prefix}`,
      {
        headers: { "Add-Padding": "true" },
        signal: AbortSignal.timeout(3000),
      },
    );
    if (!response.ok) throw new Error(`status ${String(response.status)}`);
    // Padding lines carry a count of 0 and are not matches.
    return (await response.text()).split("\n").some((line) => {
      const [found, count] = line.trim().split(":");
      return found === suffix && Number(count) > 0;
    });
  } catch {
    log.warn("Breach check failed; the password was accepted");
    return false;
  }
}
