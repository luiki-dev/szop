import type { Database } from "./database.ts";

// The advisory lock that lets one task at a time check and apply the
// migrations: "Szop" in ASCII, then 1. A fixed number, plain to read in
// pg_locks; PH-31's cleanup job takes another one beside it (PH-37 spec,
// decision 7).
export const migrationLockKey = 0x537a6f7000000001n;

// Runs `work` while holding the lock, so tasks that start together migrate one
// after another: the next one finds nothing pending. Without it, two tasks
// apply a data migration twice, silently (ADR 0036, decision 2; the audit's
// check A). The lock is held on a connection checked out of the pool, one of
// its 5, while `work` uses the pool as usual (PH-37 spec, decision 5).
//
// No timeout (decision 6): a holder that dies loses its session and the lock
// with it; one that hangs keeps every task from listening, and the load
// balancer's checks replace them after the grace period. A task stopped while
// it waits holds its connection, so the pool's end() waits too, and the
// shutdown deadline ends the process.
export async function withMigrationLock<T>(
  db: Database,
  log: { info(message: string): void },
  work: () => Promise<T>,
): Promise<T> {
  const client = await db.$client.connect();
  try {
    log.info("waiting for the migration lock");
    await client.query("SELECT pg_advisory_lock($1)", [
      migrationLockKey.toString(),
    ]);
    log.info("migration lock taken");
    const result = await work();
    await client.query("SELECT pg_advisory_unlock($1)", [
      migrationLockKey.toString(),
    ]);
    client.release();
    return result;
  } catch (error) {
    // A session-level lock outlives a released connection. Released as
    // broken, the connection is closed, and PostgreSQL drops the lock with
    // the session.
    client.release(error as Error);
    throw error;
  }
}
