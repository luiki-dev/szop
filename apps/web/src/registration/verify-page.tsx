import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import brokenLink from "@/brand/broken-link.svg";
import hourglass from "@/brand/hourglass.svg";
import { buttonVariants } from "@/components/ui/button.tsx";
import { getWorkspace, verifyEmail } from "../api/auth.ts";
import { toastManager } from "../shell/toasts.tsx";
import { Card } from "./form.tsx";
import { forgetRegisteredAddress } from "./registered-address.ts";

// /verify?token=…: the token leaves the address before the call (NFR-4.8),
// so a reload, or no token at all, is "Link not valid" with no call.
export function VerifyPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const [token] = useState(params.get("token"));
  const [invalid, setInvalid] = useState(token === null);
  const started = useRef(false);

  useEffect(() => {
    if (token === null || started.current) return;
    started.current = true;
    window.history.replaceState(window.history.state, "", "/verify");
    void (async () => {
      if (!(await verifyEmail(token))) {
        setInvalid(true);
        return;
      }
      forgetRegisteredAddress();
      // The workspace was moved only when the guest's lists were kept, so an
      // account that has one now is the one holding them.
      const kept = await getWorkspace().then(
        (workspace) => workspace.hasWorkspace,
        () => false,
      );
      toastManager.add({
        description: kept
          ? "Welcome! Your lists are in your account now."
          : "Welcome!",
      });
      // The cookie is the account's now: drop the guest's cached answers.
      void queryClient.resetQueries();
      await navigate("/", { replace: true });
    })();
  }, [token, navigate, queryClient]);

  if (invalid) {
    return (
      <Card>
        <img src={brokenLink} alt="" className="mx-auto w-52 max-w-full" />
        <h2 className="text-center text-lg font-bold">Link not valid</h2>
        <p className="text-center">
          This link no longer works. It may have expired, or you may have used
          it already.
        </p>
        <Link to="/register/resend" className={buttonVariants()}>
          Send a new link
        </Link>
        <p className="text-center text-sm">
          Already confirmed your address?{" "}
          <Link to="/login" className="font-semibold text-link underline">
            Log in
          </Link>
        </p>
      </Card>
    );
  }
  return (
    <Card>
      <img src={hourglass} alt="" className="mx-auto w-52 max-w-full" />
      <p role="status" className="text-center">
        Confirming your address…
      </p>
    </Card>
  );
}
