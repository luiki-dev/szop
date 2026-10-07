import { useHealth } from "./use-health.ts";

function Status({ query }: { query: ReturnType<typeof useHealth> }) {
  if (query.isPending) {
    return <p>Checking the API…</p>;
  }
  if (query.data?.status === "ok") {
    return (
      <>
        <p>API: ok</p>
        <p>Database: up</p>
        <p>Schema version: {query.data.database.schemaVersion}</p>
      </>
    );
  }
  return null;
}

export function HealthPage() {
  const query = useHealth();

  return (
    <main>
      <h1>Szop</h1>
      <div role="status">
        <Status query={query} />
      </div>
    </main>
  );
}
