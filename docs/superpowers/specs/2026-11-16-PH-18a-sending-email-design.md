# PH-18a Sending email: design

## Contents

- [Goal](#goal)
- [Decisions](#decisions)
- [The design](#the-design)
  - [The sender in the API](#the-sender-in-the-api)
  - [Settings](#settings)
  - [Mailpit](#mailpit)
  - [The test script](#the-test-script)
  - [infra/base: the task role](#infrabase-the-task-role)
  - [infra/demo: the task definition](#infrademo-the-task-definition)
  - [The decisions file](#the-decisions-file)
- [Acceptance criteria](#acceptance-criteria)
- [Tests](#tests)
- [Documentation](#documentation)
- [Demo check](#demo-check)
- [Risks](#risks)
- [Out of scope](#out-of-scope)
- [Left to the builder](#left-to-the-builder)

## Goal

The API can send email, through Mailpit locally and in CI and through Amazon SES on the demo, from `noreply@szop.dzwoniec.com`, and a script run on the demo proves it ([PH-18a](../../roadmap.md#ph-18a-sending-email)).

## Decisions

[ADR 0078](../../decisions/0078-sending-email-phase-details.md#decisions).

## The design

### The sender in the API

A new folder, `apps/api/src/email/`:

- **`EmailSender`**: an interface with one method, `send(email: { to: string; subject: string; text: string; html: string }): Promise<void>`. It resolves once the transport accepted the email and rejects with the transport's error otherwise.
- **`createEmailSender(settings)`**: builds a nodemailer transporter from the settings and returns an `EmailSender` that sends with `from` set to `EMAIL_FROM`.
  - `smtp`: `nodemailer.createTransport({ host, port, secure: false })`, with no authentication; Mailpit needs none.
  - `ses`: `nodemailer.createTransport({ SES: { sesClient: new SESv2Client({}), SendEmailCommand } })`. The client takes its region and credentials from the environment ECS gives the task; no key is configured anywhere.
- **`sendInBackground(sender, email, kind, log)`**: the contract of [ADR 0078](../../decisions/0078-sending-email-phase-details.md), decision 5, as the one helper callers use. It starts `sender.send(email)`, does not return its promise, and on a rejection writes one `error` line through the given pino logger: `{ emailKind: kind, errorName, errorCode }` and a fixed message such as "email not sent". The recipient's address, the subject and the body never reach the log. `errorCode` is SES's error name (`MessageRejected`, for an address the sandbox has not verified) or nodemailer's `code` (`ECONNECTION`, `EENVELOPE`).

The sender is built once at startup in `server.ts` from the config and passed to `buildApp` in `AppDeps` as `email`, so PH-18b's routes and Better Auth's callbacks reach it there and tests can pass a fake. In this phase no route uses it.

New dependencies of `apps/api`: `nodemailer`, `@aws-sdk/client-sesv2`, and `@types/nodemailer` as a development one.

### Settings

`config.ts` gains, in the same style as the others (required, with a message naming the setting):

| Setting | Values | Where it is set |
|---|---|---|
| `EMAIL_TRANSPORT` | `smtp` or `ses` | everywhere |
| `EMAIL_FROM` | an address with an optional display name, checked as an address | everywhere: `Szop <noreply@szop.dzwoniec.com>` on the demo, the same locally |
| `SMTP_HOST` | a host name | required when `EMAIL_TRANSPORT=smtp`, ignored otherwise |
| `SMTP_PORT` | a port | as `SMTP_HOST` |

The places that feed the config: `apps/api/.env.example` (`smtp`, `localhost`, `1025`), the `x-app` environment in `compose.yaml` (`smtp`, `mailpit`, `1025`), the E2E server in `e2e/start-server.ts` (`smtp`, `localhost`, `1025`), the API tests' config helper in `apps/api/src/test/`, and the demo's task definition (`ses`).

### Mailpit

A `mailpit` service in `compose.yaml`, in the default profile so `docker compose up -d --wait` starts it in development and in CI's jobs with no change to the workflows:

- the image `axllent/mailpit`, pinned to a version (and its digest, as the other images are);
- SMTP on `127.0.0.1:1025` and the web UI and API on `127.0.0.1:8025`, published only to this machine, like PostgreSQL;
- a health check, so `--wait` waits for it;
- no volume: mail is kept in memory and lost on a restart, which is what development needs.

CI's jobs start every default service with `docker compose up -d --wait`, so Mailpit runs wherever PostgreSQL does. The API tests reach it on the host, as they reach PostgreSQL: SMTP at `localhost:1025` in the tests' config helper (`apps/api/src/test/config.ts`) and the API at `http://localhost:8025`, fixed values like the database's. The app profiles reach it as `mailpit:1025` and depend on it. The `prodlike` profile has its own network, so its app container reaches the same Mailpit by attaching `mailpit` to that network too; one Mailpit and one UI serve every profile.

### The test script

`apps/api/src/send-test-email.ts`, a third entry point beside `server.ts` and `db-setup.ts`; the image copies `apps/api/src` whole and runs TypeScript with Node directly, and its production dependencies come from `apps/api/package.json`, so the script and nodemailer reach the image with no change to the Dockerfile: it reads the config with `loadConfig(process.env)`, builds the sender, sends one email to the address given as its only argument (subject "Szop test email", a line of text and the same in HTML, with the time and the instance's ID), **waits** for the result and exits with `0`, or prints the error's name and code and exits with `1`. It waits, unlike the app, because a person runs it to see the result.

On the demo the owner runs it inside the app's container through ECS Exec: `node src/send-test-email.ts <address>`, from `/app/apps/api`. The runbook gives the commands. Locally it runs with `pnpm --filter api exec node --env-file=.env src/send-test-email.ts <address>`, and the email appears in Mailpit's UI.

### infra/base: the task role

`app_roles.tf`'s task role policy gains a statement:

- `sid = "SendEmail"`, `actions = ["ses:SendEmail"]`;
- `resources`: the `dzwoniec.com` identity's ARN (`aws_sesv2_email_identity`'s ARN in base);
- a condition `StringLike` on `ses:FromAddress` with two values, `noreply@szop.dzwoniec.com` and `*<noreply@szop.dzwoniec.com>`, so it holds whether SES reports the bare address or the address with its display name. Either way the address itself is fixed, and the identity in `resources` already keeps the sender on `dzwoniec.com`. Written this way from the start, so a mismatch does not cost the owner a second apply (Claude's call).

The task already reaches SES: it runs in the public subnets with a public IP, and its security group allows HTTPS out to `0.0.0.0/0` (`task_https` in `infra/demo/service.tf`). No endpoint or rule is added.

The policy's name changes from `ecs-exec` to a name that covers both (for example `app-task`), and the comment above the role stops saying "joins in PH-18". The owner applies `infra/base` from the branch before the demo check, and again from `main` after the merge. The execution stops once, after this task, for the first apply and the address's verification; the apply from `main` is an owner step after the merge, already in the roadmap.

### infra/demo: the task definition

The app container's environment in `infra/demo/service.tf` gains `EMAIL_TRANSPORT=ses` and `EMAIL_FROM=Szop <noreply@szop.dzwoniec.com>`. The address is a local in `infra/demo`, written once.

### The decisions file

[`working-with-claude.md`](../../development/working-with-claude.md) gains a short section in "A phase in sessions" ([OP-134](https://github.com/luiki-dev/szop/issues/399)): during a brainstorm, Claude keeps `.superpowers/brainstorm/<session>/<phase>-decisions.md` (git-ignored), appends each decision the owner approves as soon as it is taken, marking the owner's choices and Claude's calls, writes the spec from it, and points to it before a `/compact` or `/session-handoff`.

## Acceptance criteria

None. The phase delivers no criterion of the requirements: [ACC-2](../../requirements/ACC-accounts-and-guest-mode.md#acc-2) and [ACC-3](../../requirements/ACC-accounts-and-guest-mode.md#acc-3), which send the first emails, are reviewed and delivered in [PH-18b](../../roadmap.md#ph-18b-registration-and-login).

## Tests

Following [testing.md](../../development/testing.md):

- **Unit (`config.test.ts`):** each new setting missing stops the start with a message naming it; `SMTP_HOST` and `SMTP_PORT` are required only with `smtp`; an `EMAIL_FROM` that is not an address is refused.
- **Unit (`email/`):** `sendInBackground` returns before the send settles; a rejection writes one `error` line with the kind, name and code, and the line holds neither the recipient's address nor the subject (checked against the log stream); a fulfilled send writes nothing. `createEmailSender` picks the transport from the settings.
- **Integration, against Mailpit:** the SMTP sender sends to a unique address per test, and the test finds that email through Mailpit's API (`/api/v1/search?query=to:<address>`) with the expected sender, subject, text and HTML. Unique addresses keep the tests isolated from each other without clearing Mailpit, as the database tests isolate themselves.
- **The test script and `server.ts`'s wiring** are entry points, checked by hand like `db-setup.ts` ([testing.md, Rules](../../development/testing.md)): the local run in Mailpit and the demo check.
- **Infrastructure:** `terraform validate`, tflint and the plan in CI, as for every change in `infra/`.

## Documentation

- [`architecture.md`](../../architecture/architecture.md): the email service's row and the `EmailSender` paragraph say Mailpit locally and in CI instead of a console sender, the sender address, and the failure contract.
- [`stack-overview.md`](../../architecture/stack-overview.md): transactional email, SMTP, nodemailer's transports, Mailpit, and SES's sandbox.
- [`threat-model.md`](../../architecture/threat-model.md): the new outbound path, SES, with what guards it (one address by IAM, the sandbox's verified recipients, PH-20's daily cap still to come) and the log line without addresses.
- [`aws-resources.md`](../../architecture/aws-resources.md): the task role's new statement and its reference to the SES identity.
- [`demo-environment.md`](../../operations/demo-environment.md): the task role's description; verifying an address in SES's sandbox; running the test script through ECS Exec and checking `dkim=pass` in the received email's headers; what `MessageRejected` means.
- [`setup.md`](../../development/setup.md): Mailpit starts with `docker compose up`, its UI at `http://localhost:8025`, the new `.env` settings.
- [`testing.md`](../../development/testing.md): tests that read email use Mailpit's API with a unique address each.
- [`docker-compose.md`](../../development/tools/docker-compose.md): the `mailpit` service.
- New tool pages: [`mailpit.md`](../../development/tools/mailpit.md) and [`nodemailer.md`](../../development/tools/nodemailer.md).
- [`working-with-claude.md`](../../development/working-with-claude.md): the decisions file.
- [`glossary.md`](../../glossary.md): SMTP, Mailpit, MIME, transactional email, if not there yet.

## Demo check

- **Local (the production-like environment):** the test script, run inside the `prodlike` container (`docker compose exec`), sends to any address and the email appears in Mailpit's UI, with the sender, subject, text and HTML.
- **AWS:** after the owner applies `infra/base` and verifies an address, `demo-up` on the branch; through ECS Exec, the test script sends to the verified address and exits `0`; the email arrives with `dkim=pass` and DMARC `pass` in its headers, from `noreply@szop.dzwoniec.com`. Sent to an address not verified, the script exits `1` with `MessageRejected`. Then `demo-down`.

Checked by hand: none (the phase delivers no criterion).

## Risks

- **The email lands in spam.** A new sender with no reputation and the sandbox's limits may get filtered. The headers show whether DKIM and DMARC pass; if they pass and it still lands in spam, it is noted and left to the production-access decision, which is out of scope.
- **`ses:FromAddress` and SES API v2.** If the condition key does not match how API v2's `SendEmail` reports the sender, the demo check fails with `AccessDenied`. To lower the chance, the condition is written with `StringLike` and both forms from the start.
- **Region.** If ECS does not put `AWS_REGION` in the task's environment, the SES client fails to start; the fallback is setting it in the task definition.
- **A required setting breaks existing environments.** Every `.env` gains three settings; `setup.md` and the PR description say so, and the API's start message names the missing one.

## Out of scope

- Every email the app sends to users, its templates and any route that sends: [PH-18b](../../roadmap.md#ph-18b-registration-and-login).
- The E2E helper that reads Mailpit: PH-18b.
- SES production access, bounce and complaint handling, a custom MAIL FROM domain.
- The daily email cap and per-address limits: [PH-20](../../roadmap.md#ph-20-quotas-and-rate-limits).

## Left to the builder

- The exact names of the files and functions in `apps/api/src/email/` and of the policy.
- Mailpit's version and its health check command.
- Whether `scripts/check-prodlike.sh` needs a change for the `mailpit` service on the `prodlike` network.
- Whether `EMAIL_FROM` is checked with zod's `email()` on the address part or with nodemailer's own parsing.
- The test email's exact wording.
