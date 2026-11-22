import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import {
  displayNameSchema,
  passwordLimits,
  registrationSchema,
} from "@szop/shared";
import { Button } from "@/components/ui/button.tsx";
import { getSession, getWorkspace, signUp } from "../api/auth.ts";
import { ApiRequestError } from "../api/client.ts";
import { Field, FormCard, Tick } from "./form.tsx";
import { saveRegisteredAddress } from "./registered-address.ts";
import { useCancel } from "./use-cancel.ts";

type Values = {
  name: string;
  email: string;
  password: string;
  repeat: string;
};
type Errors = Partial<Record<keyof Values, string>>;

export function emailError(email: string): string | undefined {
  if (email.trim() === "") return "Enter an email address.";
  return registrationSchema.shape.email.safeParse(email.trim()).success
    ? undefined
    : "Enter a valid email address.";
}

// The password's length is counted in UTF-16 code units, as the server counts
// it (the schema's own refinements), so an emoji counts as 2.
function passwordError(password: string): string | undefined {
  if (password.length < passwordLimits.min)
    return "Use at least 15 characters.";
  return registrationSchema.shape.password.safeParse(password).error?.issues[0]
    ?.message;
}

const checks: { [K in keyof Values]: (values: Values) => string | undefined } =
  {
    name: ({ name }) =>
      displayNameSchema.safeParse(name).error?.issues[0]?.message,
    email: ({ email }) => emailError(email),
    password: ({ password }) => passwordError(password),
    repeat: ({ password, repeat }) =>
      repeat === password ? undefined : "The passwords don't match.",
  };

const fields = Object.keys(checks) as (keyof Values)[];

const unreachable =
  "Couldn't create the account. Check your connection and try again.";

// /register: the form of the mockup. Errors show under their field when it is
// left and on submit; the breached-password refusal comes from the server.
export function RegisterPage() {
  const navigate = useNavigate();
  const cancel = useCancel();
  const location = useLocation();
  const [values, setValues] = useState<Values>({
    name: (location.state as { name?: string } | null)?.name ?? "",
    email: "",
    password: "",
    repeat: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [keep, setKeep] = useState(true);
  const [failed, setFailed] = useState<string>();
  const [sending, setSending] = useState(false);

  const session = useQuery({
    queryKey: ["session"],
    queryFn: getSession,
    retry: false,
  });
  const workspace = useQuery({
    queryKey: ["workspace"],
    queryFn: getWorkspace,
    retry: false,
  });

  // An account's session (after a verification, then Back): nothing to register.
  if (session.data && !session.data.user.isAnonymous) {
    return <Navigate to="/" replace />;
  }

  const change = (field: keyof Values) => (value: string) => {
    const next = { ...values, [field]: value };
    setValues(next);
    // An error stays until the field is valid again, then goes at once.
    if (errors[field]) setErrors({ ...errors, [field]: checks[field](next) });
  };
  const leave = (field: keyof Values) => () => {
    setErrors({ ...errors, [field]: checks[field](values) });
  };
  const field = (name: keyof Values) => ({
    value: values[name],
    error: errors[name],
    onChange: change(name),
    onBlur: leave(name),
  });

  const submit = async () => {
    const found: Errors = {};
    for (const name of fields) {
      const message = checks[name](values);
      if (message) found[name] = message;
    }
    setErrors(found);
    setFailed(undefined);
    if (Object.keys(found).length > 0) return;

    const hasWorkspace = workspace.data?.hasWorkspace === true;
    const body = registrationSchema.parse({
      name: values.name,
      email: values.email.trim(),
      password: values.password,
      // No checkbox: a workspace made before the link is opened is moved too.
      keepGuestData: hasWorkspace ? keep : true,
    });
    setSending(true);
    try {
      await signUp(body);
      saveRegisteredAddress(body.email);
      await navigate("/register/sent", { state: { name: body.name } });
    } catch (error) {
      if (
        error instanceof ApiRequestError &&
        error.code === "password_breached"
      ) {
        setErrors({ password: error.message });
      } else {
        setFailed(
          error instanceof ApiRequestError &&
            error.status < 500 &&
            error.status !== 401
            ? error.message
            : unreachable,
        );
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <FormCard
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Field
          label="Your name"
          hint="Shown to people you share lists with."
          autoComplete="name"
          {...field("name")}
        />
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          {...field("email")}
        />
        <Field
          label="Password"
          secret
          hint="15 to 128 characters. A phrase works well."
          autoComplete="new-password"
          {...field("password")}
        />
        <Field
          label="Repeat password"
          secret
          autoComplete="new-password"
          {...field("repeat")}
        />
        {workspace.data?.hasWorkspace && (
          <Tick
            label="Keep this browser's lists"
            hint={`${lists(workspace.data.lists)} move into the account. Untick to start fresh.`}
            checked={keep}
            onChange={setKeep}
          />
        )}
        {failed && (
          <p role="alert" className="text-sm font-semibold text-destructive">
            {failed}
          </p>
        )}
        <Button type="submit" disabled={sending}>
          Create account
        </Button>
        <Button type="button" variant="outline" onClick={cancel}>
          Cancel
        </Button>
      </FormCard>
      <p className="mt-3 text-center text-sm">
        Already have an account?{" "}
        <Link to="/login" className="font-semibold text-link underline">
          Log in
        </Link>
      </p>
    </>
  );
}

function lists(count: number): string {
  return count === 0
    ? "Your catalog"
    : `${String(count)} ${count === 1 ? "list" : "lists"} and your catalog`;
}
