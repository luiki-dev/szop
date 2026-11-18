# PH-18a Sending email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Implementers:** read [`docs/superpowers/plans/CLAUDE.md`](CLAUDE.md) before your task.

**Goal:** The API can send email, through Mailpit locally and in CI and through Amazon SES on the demo, from `noreply@szop.dzwoniec.com`, and a script run on the demo proves it.

**Architecture:** A small `apps/api/src/email/` module: an `EmailSender` built on nodemailer with an SMTP transport (Mailpit) or the SES transport (`@aws-sdk/client-sesv2`, the task role's credentials), and a `sendInBackground` helper that holds the failure contract. Four new required settings in `config.ts`. A `mailpit` service in `compose.yaml`. A third entry point, `send-test-email.ts`, run through ECS Exec on the demo. One new IAM statement on the task role in `infra/base`, two environment variables in `infra/demo`.

**Tech Stack:** nodemailer, `@aws-sdk/client-sesv2`, Mailpit (`axllent/mailpit`), zod, Vitest, Docker Compose, Terraform.

**Spec:** [`docs/superpowers/specs/2026-11-16-PH-18a-sending-email-design.md`](../specs/2026-11-16-PH-18a-sending-email-design.md); decisions in [ADR 0078](../../decisions/0078-sending-email-phase-details.md). No acceptance criteria ([Acceptance criteria](../specs/2026-11-16-PH-18a-sending-email-design.md#acceptance-criteria)); the docs to update are in its [Documentation](../specs/2026-11-16-PH-18a-sending-email-design.md#documentation).

## Order of work

1. [Task 1: The email settings](#task-1-the-email-settings)
2. [Task 2: Mailpit and the sender](#task-2-mailpit-and-the-sender)
3. [Task 3: The test script](#task-3-the-test-script)
4. [Task 4: The task role and the task definition](#task-4-the-task-role-and-the-task-definition) — 🛑 stop
5. [Task 5: The documentation](#task-5-the-documentation)

## Global Constraints

- The branch is `feat/ph-18a-sending-email`. Scopes: `api` (Tasks 1 to 3), `infra` (Task 4), none for Task 5's `docs` commit; ADR 0078's notes go in the commit of the task that makes them.
- **Rhythm** ([ADR 0078](../../decisions/0078-sending-email-phase-details.md), decision 1): one stop, after Task 4. There the owner applies `infra/base` from the branch (#448) and verifies the addresses SES's sandbox delivers to (#155). The other tasks go on without a stop.
- The sender address is `Szop <noreply@szop.dzwoniec.com>` everywhere: the demo, `.env.example` and Compose.
- **A failed send never logs the recipient's address, the subject or the body**, and never the error's `message`, which can quote the address. The log line holds only `emailKind`, `errorName` and `errorCode`, with the message `email not sent`.
- No AWS key anywhere: the SES client takes its region and credentials from the environment ECS gives the task.
- Mailpit is fixed at `localhost:1025` (SMTP) and `http://localhost:8025` (API) in tests, like PostgreSQL's `localhost:5432`.
- **Two deviations from the spec, to record in ADR 0078's "Settled while building" in the task that makes them:**
  1. `AppDeps` does not gain `email`, and `server.ts` does not build a sender yet: nothing in this phase uses it, and a required field would change 36 `buildApp` calls in 14 test files. PH-18b adds it with its first caller (Task 2).
  2. `e2e/start-server.ts` does not change: it spreads `apps/api/.env`, which CI copies from `.env.example`, so the new settings reach the E2E server from there (Task 1).
- `pnpm check` passes after every task.

## Review Focus

1. **An error whose message quotes the address** (nodemailer's `EENVELOPE`, an SES rejection naming the recipient). Expected: the log line holds neither the address nor the subject. Task 2 tests it with an error whose `message` contains both.
2. **A send that never settles** (Mailpit stopped, SES slow). Expected: `sendInBackground` returns at once; the caller never waits. Task 2 tests it with a promise that never settles.
3. **A rejection with something other than an `Error`** (a string). Expected: one `error` line, no unhandled rejection, no crash. Task 2 tests it.
4. **A developer's existing `.env` without the new settings.** Expected: the start stops with `EMAIL_TRANSPORT: missing` and `EMAIL_FROM: missing`, not a stack trace. Task 1 tests it; Task 5 puts it in `setup.md`.
5. **`SMTP_HOST` left set with `EMAIL_TRANSPORT=ses`, or an `EMAIL_FROM` with a display name around a bad address.** Expected: the first is accepted and ignored; the second is refused naming `EMAIL_FROM`. Task 1 tests both.

---

## File Structure

| File | Responsibility |
|---|---|
| `apps/api/src/config.ts`, `config.test.ts` | The four email settings and their checks; `Config.email` |
| `apps/api/src/test/config.ts` | `testConfig()` gains the email settings (Mailpit) |
| `apps/api/.env.example` | The local values, with comments |
| `apps/api/src/email/sender.ts`, `sender.test.ts` | `Email`, `EmailSender`, `createEmailSender` |
| `apps/api/src/email/background.ts`, `background.test.ts` | `sendInBackground`: the failure contract |
| `apps/api/src/send-test-email.ts` | The test script, an entry point |
| `compose.yaml` | The `mailpit` service; the app profiles' settings and dependency |
| `infra/base/app_roles.tf` | The task role's `SendEmail` statement; the policy renamed |
| `infra/demo/locals.tf`, `infra/demo/service.tf` | The sender address; the app container's two settings |

---

### Task 1: The email settings

**Files:**
- Modify: `apps/api/src/config.ts`
- Modify: `apps/api/src/config.test.ts`
- Modify: `apps/api/src/test/config.ts`
- Modify: `apps/api/.env.example`
- Modify: `docs/decisions/0078-sending-email-phase-details.md` ("Settled while building", deviation 2)

**Interfaces:**
- Produces, in `config.ts`:

  ```ts
  export type EmailSettings = { from: string } & (
    | { transport: "smtp"; smtpHost: string; smtpPort: number }
    | { transport: "ses" }
  );
  // Config gains:
  email: EmailSettings;
  ```

- [x] **Step 1: Write the failing tests in `config.test.ts`**

Add `EMAIL_TRANSPORT: "smtp"`, `EMAIL_FROM: "Szop <noreply@szop.dzwoniec.com>"`, `SMTP_HOST: "localhost"`, `SMTP_PORT: "1025"` to `valid`; the existing "returns the typed config" test expects `email: { transport: "smtp", from: "Szop <noreply@szop.dzwoniec.com>", smtpHost: "localhost", smtpPort: 1025 }`. Then, in a `describe("email settings")`:

```ts
it("refuses a start without EMAIL_TRANSPORT or EMAIL_FROM, naming each", () => {
  const { EMAIL_TRANSPORT: _t, EMAIL_FROM: _f, ...env } = valid;
  const message = errorFor(env);
  expect(message).toContain("EMAIL_TRANSPORT: missing");
  expect(message).toContain("EMAIL_FROM: missing");
});

it.each(["SMTP_HOST", "SMTP_PORT"])("requires %s with smtp", (name) => {
  expect(errorFor({ ...valid, [name]: undefined })).toContain(`${name}: missing`);
});

it("ignores the SMTP settings with ses", () => {
  expect(loadConfig({ ...valid, EMAIL_TRANSPORT: "ses", SMTP_PORT: undefined }).email)
    .toEqual({ transport: "ses", from: "Szop <noreply@szop.dzwoniec.com>" });
});

it.each(["noreply@szop.dzwoniec.com", "Szop <noreply@szop.dzwoniec.com>"])(
  "accepts EMAIL_FROM %s", (from) => {
    expect(loadConfig({ ...valid, EMAIL_FROM: from }).email.from).toBe(from);
  });

it.each(["noreply", "Szop <noreply>", "Szop noreply@szop.dzwoniec.com", ""])(
  "refuses EMAIL_FROM %j", (from) => {
    expect(errorFor({ ...valid, EMAIL_FROM: from })).toContain("EMAIL_FROM:");
  });

it("refuses an unknown transport", () => {
  expect(errorFor({ ...valid, EMAIL_TRANSPORT: "sendmail" })).toContain("EMAIL_TRANSPORT:");
});
```

- [x] **Step 2: Run them to see them fail**

Run: `pnpm vitest run --project api src/config.test.ts`
Expected: FAIL; `email` is missing from the config.

- [x] **Step 3: Implement the settings in `config.ts`**

- `EMAIL_TRANSPORT: z.enum(["smtp", "ses"])`.
- `EMAIL_FROM`: a bare address, or `Display Name <address>`; the address part checked with `z.email()`. Parse with `/^(?:[^<>]*<([^<>]+)>|([^<>\s]+))$/` and check the captured address; the message says `must be an email address, optionally as "Name <address>"`.
- `SMTP_HOST: z.string().min(1).optional()`, `SMTP_PORT: port.optional()`, and a `superRefine` on the object that adds an issue with `path: ["SMTP_HOST"]` (or `SMTP_PORT`) when `EMAIL_TRANSPORT` is `smtp` and it is unset, so `loadConfig`'s existing mapping prints `SMTP_HOST: missing`. A comment over the email settings cites ADR 0078, decision 8.
- `loadConfig` returns `email` built from the parsed data; with `ses` the SMTP settings are dropped.

- [x] **Step 4: Run them to see them pass**

Run: `pnpm vitest run --project api src/config.test.ts`
Expected: PASS.

- [x] **Step 5: `testConfig()` and `.env.example`**

`testConfig()` gains `email: { transport: "smtp", from: "Szop <noreply@szop.dzwoniec.com>", smtpHost: "localhost", smtpPort: 1025 }`, with a comment: Mailpit from `compose.yaml`, like PostgreSQL. `.env.example` gains, after `APP_ORIGIN`, the four settings (`smtp`, `Szop <noreply@szop.dzwoniec.com>`, `localhost`, `1025`) with comments in the file's style: what each is, `smtp` for Mailpit locally and `ses` on the demo, Mailpit's UI at `http://localhost:8025`, ADR 0078. `EMAIL_FROM`'s value is quoted if `node --env-file` needs it for the space and angle brackets (check by running `pnpm --filter api start` against a running PostgreSQL, or `node --env-file=.env -e "console.log(process.env.EMAIL_FROM)"` from `apps/api`).

- [x] **Step 6: ADR 0078, deviation 2**

Add to "Settled while building": `e2e/start-server.ts` sets none of the email settings; it spreads `apps/api/.env`, so they come from there (CI copies `.env.example`).

- [x] **Step 7: Check and commit**

Run: `pnpm check` — Expected: passes. Copy the four lines into your own `apps/api/.env` first, or the E2E start fails.

```bash
git add apps/api/src/config.ts apps/api/src/config.test.ts apps/api/src/test/config.ts apps/api/.env.example docs/decisions/0078-sending-email-phase-details.md
git commit -m "feat(api): add the email settings"
```

---

### Task 2: Mailpit and the sender

**Files:**
- Modify: `compose.yaml`
- Modify: `apps/api/package.json` (and `pnpm-lock.yaml`)
- Create: `apps/api/src/email/sender.ts`, `apps/api/src/email/sender.test.ts`
- Create: `apps/api/src/email/background.ts`, `apps/api/src/email/background.test.ts`
- Maybe modify: `scripts/check-prodlike.sh` (left to the builder in the spec)
- Modify: `docs/decisions/0078-sending-email-phase-details.md` ("Settled while building", deviation 1 and Mailpit's version)

**Interfaces:**
- Consumes: `EmailSettings` from Task 1.
- Produces:

  ```ts
  // sender.ts
  export interface Email { to: string; subject: string; text: string; html: string }
  export interface EmailSender { send(email: Email): Promise<void> }
  // sesClient: tests pass a fake; left out, a new SESv2Client({}).
  export function createEmailSender(settings: EmailSettings, sesClient?: SESv2Client): EmailSender;

  // background.ts
  export function sendInBackground(
    sender: EmailSender, email: Email, kind: string, log: Pick<FastifyBaseLogger, "error">,
  ): void;
  ```

- [ ] **Step 1: Mailpit in `compose.yaml`**

A `mailpit` service, in the default profile, with a comment in the file's style (what it is, ADR 0078, decision 3):
- `image: axllent/mailpit:<latest v1 release>`, pinned by tag like `postgres:18.6` (the file pins no digest; the spec's "and its digest" was wrong, note it in the ADR);
- `restart: unless-stopped`, like PostgreSQL;
- `ports: ["127.0.0.1:1025:1025", "127.0.0.1:8025:8025"]`;
- `healthcheck: test: ["CMD", "/mailpit", "readyz"]`, `2s`/`2s`/`15` like the others;
- `networks: [default, prodlike]`, so `app-prodlike` reaches it too; no volume.

In `x-app`: `depends_on` gains `mailpit: { condition: service_healthy }`; `environment` gains `EMAIL_TRANSPORT: smtp`, `EMAIL_FROM: Szop <noreply@szop.dzwoniec.com>`, `SMTP_HOST: mailpit`, `SMTP_PORT: "1025"`. `app-prodlike`'s own `depends_on` gains `mailpit` as well.

Run: `docker compose up -d --wait` — Expected: `postgres` and `mailpit` healthy; `curl -sf http://localhost:8025/api/v1/messages` answers JSON.

- [ ] **Step 2: Add the dependencies**

Run: `pnpm --filter @szop/api add nodemailer @aws-sdk/client-sesv2 && pnpm --filter @szop/api add -D @types/nodemailer`

- [ ] **Step 3: Write the failing tests**

`background.test.ts` (unit; a fake sender and a fake `log` whose `error` records its arguments):

```ts
const email = { to: "someone@example.com", subject: "Secret subject", text: "t", html: "<p>t</p>" };

it("returns before the send settles", () => {
  const sender = { send: () => new Promise<void>(() => {}) };
  expect(sendInBackground(sender, email, "test", log)).toBeUndefined();
  expect(log.error).not.toHaveBeenCalled();
});

it("logs a rejection once, without the address or the subject", async () => {
  const error = Object.assign(new Error("Recipient someone@example.com: Secret subject"), { code: "EENVELOPE" });
  sendInBackground({ send: () => Promise.reject(error) }, email, "verification", log);
  await vi.waitFor(() => expect(log.error).toHaveBeenCalledTimes(1));
  expect(log.error).toHaveBeenCalledWith(
    { emailKind: "verification", errorName: "Error", errorCode: "EENVELOPE" }, "email not sent");
  const written = JSON.stringify(log.error.mock.calls);
  expect(written).not.toContain("someone@example.com");
  expect(written).not.toContain("Secret subject");
});

it("logs a rejection that is not an Error", async () => { /* reject("boom"): one call, errorName and errorCode undefined */ });

it("logs nothing when the send succeeds", async () => { /* resolve; flush with await Promise.resolve(); no call */ });
```

`sender.test.ts` (integration against Mailpit, fixed URLs per the Global Constraints):

```ts
it("sends through SMTP to Mailpit", async () => {
  const to = `test-${randomUUID()}@example.com`;
  await createEmailSender(testConfig().email).send({ to, subject: "Hello", text: "Plain", html: "<p>Rich</p>" });
  // GET http://localhost:8025/api/v1/search?query=to:<to> → messages[0].ID,
  // then GET /api/v1/message/<ID>
  expect(message).toMatchObject({
    From: { Name: "Szop", Address: "noreply@szop.dzwoniec.com" },
    To: [{ Address: to }], Subject: "Hello", Text: expect.stringContaining("Plain"), HTML: expect.stringContaining("<p>Rich</p>"),
  });
});

it("rejects when the SMTP server cannot be reached", async () => {
  const settings = { transport: "smtp", from: "noreply@szop.dzwoniec.com", smtpHost: "127.0.0.1", smtpPort: 1 } as const;
  await expect(createEmailSender(settings).send(email)).rejects.toThrow();
});

it("sends through SES with the From address", async () => {
  // A fake client whose send records the command and resolves { MessageId: "id" }.
  await createEmailSender({ transport: "ses", from: "Szop <noreply@szop.dzwoniec.com>" }, fake).send(email);
  expect(recorded).toBeInstanceOf(SendEmailCommand);
  expect(Buffer.from(recorded.input.Content.Raw.Data).toString()).toContain("From: Szop <noreply@szop.dzwoniec.com>");
});
```

The search may be retried briefly (`vi.waitFor`) in case Mailpit stores the message just after the SMTP reply.

- [ ] **Step 4: Run them to see them fail**

Run: `pnpm vitest run --project api src/email`
Expected: FAIL; the modules do not exist.

- [ ] **Step 5: Implement `sender.ts` and `background.ts`**

`createEmailSender`: `smtp` → `nodemailer.createTransport({ host, port, secure: false })`; `ses` → `nodemailer.createTransport({ SES: { sesClient, SendEmailCommand } })`; `send` calls `transporter.sendMail({ from: settings.from, ...email })` and resolves to `void`. `sendInBackground`: `void sender.send(email).catch(...)` with the line from the Global Constraints, reading `name` and `code` only when the reason is an object. A one-line comment on each cites ADR 0078, decisions 3 and 5.

- [ ] **Step 6: Run them to see them pass**

Run: `pnpm vitest run --project api src/email`
Expected: PASS.

- [ ] **Step 7: The production-like environment**

Run `pnpm check:prodlike`. If it fails because of `mailpit` (the network, its start), change `scripts/check-prodlike.sh` as little as it needs. Expected: passes.

- [ ] **Step 8: ADR 0078 and commit**

Add to "Settled while building": deviation 1 (`AppDeps.email` and the sender in `server.ts` come with PH-18b's first caller, because nothing uses them now and a required field changes 36 `buildApp` calls), and Mailpit's pinned tag without a digest, like the file's other images.

Run: `pnpm check` — Expected: passes.

```bash
git add compose.yaml apps/api/package.json pnpm-lock.yaml apps/api/src/email docs/decisions/0078-sending-email-phase-details.md
git commit -m "feat(api): send email through nodemailer, with Mailpit locally"
```

---

### Task 3: The test script

**Files:**
- Create: `apps/api/src/send-test-email.ts`

**Interfaces:**
- Consumes: `loadConfig` (Task 1), `createEmailSender` (Task 2), `instanceId` from `instance.ts`.

- [ ] **Step 1: Write `send-test-email.ts`**

An entry point like `db-setup.ts`: first line `// Stryker disable all: entry point, checked by hand (testing.md, Rules): it only wires the sender, which sender.test.ts tests`; a comment that it is the third file reading `process.env` and how to run it (`node src/send-test-email.ts <address>`, through ECS Exec on the demo, ADR 0078, decision 4).
- No argument, or more than one: print `Usage: node src/send-test-email.ts <address>` to stderr, exit `1`.
- `loadConfig(process.env)`; on an error, print its message and exit `1`, like `server.ts`.
- Send: subject `Szop test email`; text `Sent by Szop's test script at <ISO time> from instance <instanceId>.`; the same sentence in a `<p>` as HTML.
- Wait for it. On success print `{"msg":"test email sent"}` and exit `0`; on failure print `{"msg":"test email not sent","errorName":…,"errorCode":…}` and exit `1`. The address is not printed (the person running it typed it).

- [ ] **Step 2: Check it by hand, locally**

From `apps/api`, with Mailpit running:

Run: `node --env-file=.env src/send-test-email.ts check-${RANDOM}@example.com; echo $?` — Expected: `{"msg":"test email sent"}`, `0`; the email is in `curl -s 'http://localhost:8025/api/v1/search?query=subject:"Szop test email"'` from `Szop <noreply@szop.dzwoniec.com>`.
Run: `node --env-file=.env src/send-test-email.ts; echo $?` — Expected: the usage line, `1`.
Run: `SMTP_PORT=1 node --env-file=.env src/send-test-email.ts x@example.com; echo $?` — Expected: `test email not sent` with a code, `1`. (`--env-file` does not override a variable already set.)

- [ ] **Step 3: Check it in the image**

Run: `pnpm check:prodlike` to build and start the production-like environment (or start its profile), then `docker compose --profile prodlike exec app-prodlike node src/send-test-email.ts prodlike@example.com` — Expected: `0`, and the email in Mailpit. This is the spec's local demo check; record the result in the commit message body.

- [ ] **Step 4: Check and commit**

Run: `pnpm check` — Expected: passes.

```bash
git add apps/api/src/send-test-email.ts
git commit -m "feat(api): add the test email script"
```

---

### Task 4: The task role and the task definition

**Files:**
- Modify: `infra/base/app_roles.tf`
- Modify: `infra/demo/locals.tf`, `infra/demo/service.tf`

- [ ] **Step 1: The statement in `infra/base/app_roles.tf`**

In `data "aws_iam_policy_document" "app_task"`, after `EcsExec`, a statement with a comment (one sender address, ADR 0078, decision 7; `StringLike` with both forms because SES may report the address with or without its display name):

```hcl
statement {
  sid       = "SendEmail"
  actions   = ["ses:SendEmail"]
  resources = [aws_sesv2_email_identity.domain.arn]

  condition {
    test     = "StringLike"
    variable = "ses:FromAddress"
    values   = ["noreply@szop.${local.domain}", "*<noreply@szop.${local.domain}>"]
  }
}
```

The role's comment says it holds ECS Exec's channel and sending as Szop's address; `aws_iam_role_policy.app_task`'s `name` becomes `app-task`.

- [ ] **Step 2: The task definition in `infra/demo`**

`locals.tf` gains `email_from = "Szop <noreply@${local.app_hostname}>"` with a comment that the IAM statement in `infra/base` allows only this address. The app container's `environment` in `service.tf` gains `{ name = "EMAIL_TRANSPORT", value = "ses" }` and `{ name = "EMAIL_FROM", value = local.email_from }`. `db_setup` does not change.

- [ ] **Step 3: Check**

Run, in each of `infra/base` and `infra/demo`: `terraform fmt -check && terraform validate && tflint` — Expected: no output, `Success!`, no findings. Then `pnpm check`. CI's plan shows the change; `infra/base`'s plan shows one policy replaced (the rename) and no other change.

- [ ] **Step 4: Commit and push**

```bash
git add infra/base/app_roles.tf infra/demo/locals.tf infra/demo/service.tf
git commit -m "feat(infra): let the app's task send email as Szop through SES"
git push
```

- [ ] **Step 5: 🛑 Stop for the owner**

Summarize the task and the plan's expected change. The owner applies `infra/base` from this branch (#448) and verifies the addresses the demo sends to in SES's sandbox (#155). Go on only when the owner says so.

---

### Task 5: The documentation

**Files:** every file in the spec's [Documentation](../specs/2026-11-16-PH-18a-sending-email-design.md#documentation), created or modified as it says, including the decisions-file section in `working-with-claude.md` and the two new tool pages, `docs/development/tools/mailpit.md` and `nodemailer.md`, in the style of the other tool pages.

- [ ] **Step 1: Write the changes**

Beyond what the spec lists, the docs say:
- `setup.md`: **an existing `apps/api/.env` needs the four new lines** from `.env.example`, or the API refuses to start naming them.
- `demo-environment.md`: the commands to run the script through ECS Exec (the existing `aws ecs execute-command … --container app` with `--command "node src/send-test-email.ts <address>"` from `/app/apps/api`), where to read `dkim=pass` and DMARC `pass` (the received email's `Authentication-Results` header), and that `MessageRejected` means the recipient is not verified while SES is in its sandbox, `AccessDenied` that the task role's statement is missing or does not match the sender.
- Every status gets its icon, every requirement mention its link, and each new acronym (SMTP, MIME) its glossary entry and expansion on first use (root `CLAUDE.md`, "Writing style").
- A long document whose headings change has its `## Contents` updated.

- [ ] **Step 2: Check and commit**

Run: `pnpm check` — Expected: passes (markdown lint, links).

```bash
git add docs
git commit -m "docs: describe sending email, Mailpit and the demo's email check"
```

Then the plan's last task is done: finish with `/finish-phase`.
