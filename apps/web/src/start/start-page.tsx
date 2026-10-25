// The Start page at /, until the lists take its place (ADR 0049). The shell
// gives it its title; the API's status is in the menu.
export function StartPage() {
  return (
    <section className="mt-4 rounded-surface bg-card p-4 text-card-foreground">
      <h2 className="text-lg font-bold">Welcome to Szop</h2>
      <p className="mt-1 text-muted-foreground">
        Szop is a shopping list app. Your lists will be here soon.
      </p>
    </section>
  );
}
