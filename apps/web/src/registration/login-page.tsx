import { useSearchParams } from "react-router";
import { Button } from "@/components/ui/button.tsx";
import { Card } from "./form.tsx";
import { useCancel } from "./use-cancel.ts";

// /login until PH-18c: the notice a converted guest is sent here with, and no
// form yet.
export function LoginPage() {
  const cancel = useCancel();
  const [params] = useSearchParams();
  return (
    <Card>
      {params.has("confirmed") && (
        <p role="status" className="font-semibold">
          Your address was confirmed in another browser. Log in here to see your
          lists.
        </p>
      )}
      <p>Logging in comes with the next update.</p>
      <Button type="button" variant="outline" onClick={cancel}>
        Cancel
      </Button>
    </Card>
  );
}
