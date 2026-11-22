import { useState } from "react";
import { Link, Navigate, useLocation } from "react-router";
import mailbox from "@/brand/mailbox.svg";
import { buttonVariants } from "@/components/ui/button.tsx";
import { resendLink } from "../api/auth.ts";
import { showError, toastManager } from "../shell/toasts.tsx";
import { Card } from "./form.tsx";
import { registeredAddress } from "./registered-address.ts";

// /register/sent: "Check your inbox". The address is the one this browser
// saved at the sign-up, not one the server sent back.
export function SentPage() {
  const address = registeredAddress();
  const name = (useLocation().state as { name?: string } | null)?.name;
  const [sending, setSending] = useState(false);

  if (address === null) return <Navigate to="/register" replace />;

  const again = async () => {
    setSending(true);
    try {
      await resendLink(address);
      toastManager.add({ description: `Link sent to ${address}.` });
    } catch {
      showError("The link wasn't sent. Wait a minute and try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Card>
        <img src={mailbox} alt="" className="mx-auto w-52 max-w-full" />
        <p className="text-center">
          We sent a link to
          <br />
          <b className="break-all">{address}</b>.
          <br />
          Open it to confirm your address.
        </p>
        <p className="text-center text-xs text-muted-foreground">
          Until then you stay a guest, and your lists stay in this browser.
        </p>
        <Link to="/" className={buttonVariants()}>
          Back to my lists
        </Link>
        <Link
          to="/register"
          state={name === undefined ? null : { name }}
          className="text-center font-semibold text-link underline"
        >
          Wrong address? Start again
        </Link>
      </Card>
      <p className="mt-3 text-center text-sm">
        Nothing arrived?{" "}
        <button
          type="button"
          disabled={sending}
          onClick={() => {
            void again();
          }}
          className="font-semibold text-link underline"
        >
          Send the link again
        </button>
      </p>
    </>
  );
}
