import { House, ListTree, Palette, type LucideIcon } from "lucide-react";
import { Link, NavLink } from "react-router";
import logo from "@/brand/logo.svg";
import { cn } from "@/lib/utils.ts";
import { ApiStatus } from "./api-status.tsx";
import { ColorSchemeControl } from "./color-scheme-control.tsx";

function MenuLink({
  to,
  icon: Icon,
  label,
  onNavigate,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
  onNavigate?: (() => void) | undefined;
}) {
  return (
    <NavLink
      to={to}
      end
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "flex min-h-12 items-center gap-3 rounded-control px-3 font-semibold outline-none hover:bg-accent/60 focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          isActive && "bg-accent text-accent-foreground",
        )
      }
    >
      <Icon aria-hidden="true" className="size-5" />
      {label}
    </NavLink>
  );
}

// The one menu, in the phone's drawer and in the desktop's sidebar, so the
// two cannot drift (visual-design.md, section 5). It lists only the pages
// that exist (ADR 0049); each phase adds its own entry.
export function Menu({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex min-h-full flex-col gap-4 p-3">
      <Link
        to="/"
        onClick={onNavigate}
        aria-label="Szop, Start"
        className="flex min-h-12 items-center gap-2 self-start rounded-control px-1 outline-none focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <img src={logo} alt="" width={40} height={40} />
        <span className="text-2xl font-bold text-link">szop</span>
      </Link>
      <ul className="flex flex-col gap-1">
        <li>
          <MenuLink to="/" icon={House} label="Start" onNavigate={onNavigate} />
        </li>
      </ul>
      <div>
        <p className="px-3 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Setup
        </p>
        <ul className="flex flex-col gap-1">
          <li>
            <MenuLink
              to="/catalog"
              icon={ListTree}
              label="Catalog"
              onNavigate={onNavigate}
            />
          </li>
        </ul>
      </div>
      <div>
        <p className="px-3 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Developer
        </p>
        <ul className="flex flex-col gap-1">
          <li>
            <MenuLink
              to="/design"
              icon={Palette}
              label="Design system"
              onNavigate={onNavigate}
            />
          </li>
        </ul>
      </div>
      <div className="mt-auto flex flex-col gap-4 border-t border-border px-3 pt-4">
        <ApiStatus />
        <ColorSchemeControl />
      </div>
    </div>
  );
}
