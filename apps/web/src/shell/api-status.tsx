import { cn } from "@/lib/utils.ts";
import { useHealth } from "./use-health.ts";

// Decoration: the words carry the state, the dot only repeats it.
function Line({ up, children }: { up: boolean; children: string }) {
  return (
    <p className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className={cn(
          // Stryker disable next-line StringLiteral: Tailwind class name: jsdom applies no CSS, so no test can tell the change apart
          "size-2 rounded-full",
          up ? "bg-primary" : "bg-destructive",
        )}
      />
      {children}
    </p>
  );
}

// The release version, with the commit's first 7 characters when the image
// knows it. Under the status lines, in both variants.
function Version({ version, commit }: { version: string; commit: string }) {
  return (
    <p className="text-xs text-muted-foreground tabular-nums">
      Version {version}
      {commit === "unknown" ? "" : ` · ${commit.slice(0, 7)}`}
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
        <Version version={query.data.version} commit={query.data.commit} />
        <p className="text-xs text-muted-foreground tabular-nums">
          Schema version: {query.data.database.schemaVersion}
        </p>
      </>
    );
  }
  return (
    <>
      <Line up>API: reachable</Line>
      <Line up={false}>Database: down</Line>
      <Version version={query.data.version} commit={query.data.commit} />
    </>
  );
}

// The API's status at the bottom of the menu, in the walking skeleton's
// words (ADR 0049). It asks when the menu is mounted: on a phone each time
// the drawer opens, on a desktop once per page load.
export function ApiStatus() {
  const query = useHealth();

  return (
    <div role="status" className="flex flex-col gap-1 text-sm">
      <Status query={query} />
    </div>
  );
}
