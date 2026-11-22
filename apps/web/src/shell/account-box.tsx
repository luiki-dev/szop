import { Link, useLocation } from "react-router";
import { buttonVariants } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";
import { useSession } from "./use-session.ts";

// The bottom of the menu, above the API status (ph-18b-journey-v5.html): a
// guest's way in, or the account's name and email ("Log out" is PH-18c's).
export function AccountBox({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useSession();
  const { pathname } = useLocation();
  if (user) {
    return (
      <div className="flex flex-col gap-1 rounded-surface bg-muted p-3">
        <span className="font-bold break-words">{user.name}</span>
        <span className="text-xs break-all text-muted-foreground">
          {user.email}
        </span>
      </div>
    );
  }
  // On its own page an entry looks like the menu's current page, not a button.
  const current = (to: string) => (pathname === to ? "page" : undefined);
  return (
    <div className="flex flex-col gap-3 rounded-surface bg-muted p-3">
      <span>Keep your lists on every device.</span>
      <Link
        to="/login"
        onClick={onNavigate}
        aria-current={current("/login")}
        className={cn(
          buttonVariants(),
          current("/login") && "bg-accent text-accent-foreground",
        )}
      >
        Log in
      </Link>
      <p className="flex min-h-12 flex-wrap items-center justify-center gap-1 text-center text-sm">
        No account?
        <Link
          to="/register"
          onClick={onNavigate}
          aria-current={current("/register")}
          className={cn(
            "inline-flex min-h-12 items-center font-semibold underline",
            current("/register") ? "text-accent-foreground" : "text-link",
          )}
        >
          Create account
        </Link>
      </p>
    </div>
  );
}
