import { Link } from "react-router";
import { cn } from "@/lib/utils.ts";
import { useHealth } from "./use-health.ts";

// Decoration: the words carry the state, the dot only repeats it.
function Line({ up, children }: { up: boolean; children: string }) {
  return (
    <p className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className={cn(
          "size-2.5 rounded-full",
          up ? "bg-primary" : "bg-destructive",
        )}
      />
      {children}
    </p>
  );
}

function Status({ query }: { query: ReturnType<typeof useHealth> }) {
  if (query.isPending) {
    return <p>Checking the API…</p>;
  }
  if (query.isError) {
    return <Line up={false}>Can't reach the API</Line>;
  }
  if (query.data.status === "ok") {
    return (
      <>
        <Line up>API: ok</Line>
        <Line up>Database: up</Line>
        <p className="mt-1 text-sm text-muted-foreground tabular-nums">
          Schema version: {query.data.database.schemaVersion}
        </p>
      </>
    );
  }
  return (
    <>
      <Line up>API: reachable</Line>
      <Line up={false}>Database: down</Line>
    </>
  );
}

// The walking skeleton's page, in the design tokens, until the app shell's
// Start page replaces it in PH-14b.
export function HealthPage() {
  const query = useHealth();

  return (
    <main className="mx-auto max-w-[720px] px-4 py-6">
      <h1 className="text-2xl font-extrabold">szop</h1>
      <p className="mt-1 text-muted-foreground">Shopping lists. Coming soon.</p>
      <section className="mt-4 rounded-surface bg-card p-4 text-card-foreground">
        <h2 className="mb-2 font-semibold">API status</h2>
        <div role="status" className="flex flex-col gap-1">
          <Status query={query} />
        </div>
      </section>
      <p className="mt-4">
        <Link to="/design" className="font-semibold text-link underline">
          See the design system →
        </Link>
      </p>
    </main>
  );
}
