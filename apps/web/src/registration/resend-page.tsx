import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button.tsx";
import { resendLink } from "../api/auth.ts";
import { Field, FormCard } from "./form.tsx";
import { emailError } from "./register-page.tsx";
import { saveRegisteredAddress } from "./registered-address.ts";
import { useCancel } from "./use-cancel.ts";

// /register/resend: asks for the address and goes to "Check your inbox"
// whatever the answer, so the page never says whether the address has an
// account waiting.
export function ResendPage() {
  const navigate = useNavigate();
  const cancel = useCancel();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);

  const submit = async () => {
    const message = emailError(email);
    setError(message);
    if (message) return;
    setSending(true);
    const address = email.trim();
    saveRegisteredAddress(address);
    await resendLink(address).catch(() => undefined);
    await navigate("/register/sent");
  };

  return (
    <FormCard
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <p className="text-xs text-muted-foreground">
        Enter the address you registered with. If it has an account waiting for
        confirmation, we'll send it a new link.
      </p>
      <Field
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        error={error}
        onChange={(value) => {
          setEmail(value);
          if (error) setError(emailError(value));
        }}
        onBlur={() => {
          setError(emailError(email));
        }}
      />
      <Button type="submit" disabled={sending}>
        Send link
      </Button>
      <Button type="button" variant="outline" onClick={cancel}>
        Cancel
      </Button>
    </FormCard>
  );
}
