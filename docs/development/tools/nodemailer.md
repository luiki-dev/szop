# nodemailer

nodemailer is a Node.js library that builds an email message and hands it to a **transport** that delivers it. In Szop it is the one way the API sends email, over the Simple Mail Transfer Protocol (SMTP) to [Mailpit](mailpit.md) locally and in CI, and through Amazon Simple Email Service (SES) on AWS.

## Why Szop uses it

- **One message, two transports:** [ADR 0078](../../decisions/0078-sending-email-phase-details.md), decision 3. nodemailer builds the MIME (Multipurpose Internet Mail Extensions) message once, with its headers and its text and HTML parts, and sends it over SMTP or through its SES transport, so the code is the same everywhere and only the settings differ. Considered and rejected: a sender written on the bare AWS SDK, which means building the MIME message by hand and still needs another path for local development.
- **No key on AWS:** the SES transport uses the AWS SDK's `SESv2Client`, which signs its requests with the ECS task role's temporary credentials (ADR 0078, decision 7).

## Configuration

`apps/api/src/email/sender.ts` builds one transporter from the settings `config.ts` reads ([architecture](../../architecture/architecture.md)):

- **`EMAIL_TRANSPORT=smtp`:** `nodemailer.createTransport({ host, port, secure: false })` with `SMTP_HOST` and `SMTP_PORT`, no login and no TLS, which Mailpit needs none of.
- **`EMAIL_TRANSPORT=ses`:** `nodemailer.createTransport({ SES: { sesClient, SendEmailCommand } })`, with `SESv2Client` and `SendEmailCommand` from `@aws-sdk/client-sesv2`. The client takes its region and credentials from the task's environment. It calls SES API v2's `SendEmail` only, always with the raw MIME message nodemailer built (`Content.Raw`), which IAM checks as `ses:SendRawEmail`: the one action the task role allows.
- **`EMAIL_FROM`** is every email's `From`, `Szop <noreply@szop.dzwoniec.com>` everywhere.

nodemailer ships its own types, so no `@types/nodemailer` is installed.

## Everyday use

- **Sending:** callers never use nodemailer directly; they call `sendInBackground(sender, email, kind, log)` (`apps/api/src/email/background.ts`), which starts the send without waiting and logs a failure without the address ([ADR 0078](../../decisions/0078-sending-email-phase-details.md), decision 5).
- **Its errors:** a rejected send carries a `code`: `ECONNECTION` when the SMTP server cannot be reached, `EENVELOPE` when it refuses a recipient; through SES, the error's `name` is SES's, such as `MessageRejected` (a recipient not verified in SES's sandbox) or `AccessDenied` (the task role does not allow the sender).
- **Checking it by hand:** `src/send-test-email.ts <address>` sends one email through the same sender, locally to Mailpit ([setup guide](../setup.md#11-run-the-api-and-the-page)), on the demo through ECS Exec ([the demo's runbook](../../operations/demo-environment.md#sending-a-test-email)).

## Official documentation

- nodemailer: <https://nodemailer.com/>
- The SMTP transport: <https://nodemailer.com/smtp/>
- The SES transport: <https://nodemailer.com/transports/ses/>
