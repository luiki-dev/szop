import { Link } from "react-router";
import trashCan from "@/brand/trash-can.svg";
import { buttonVariants } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";

// A page or a list that is not there: the toppled trash can, what is wrong
// and a way back. The shell's h1 (or the list page's) sits above it.
export function NotFound({ message }: { message: string }) {
  return (
    <section className="mt-8 flex flex-col items-center text-center">
      <img src={trashCan} alt="" className="w-52 max-w-full" />
      <h2 className="mt-4 text-lg font-bold">Nothing here</h2>
      <p className="mt-1 text-muted-foreground">{message}</p>
      <Link
        to="/"
        // Stryker disable next-line ObjectLiteral,StringLiteral: class names only, no behavior; the 48 px tap target is checked in e2e
        className={cn(buttonVariants({ variant: "outline" }), "mt-4")}
      >
        Back to lists
      </Link>
    </section>
  );
}
