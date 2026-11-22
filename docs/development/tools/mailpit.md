# Mailpit

Mailpit is a small mail server for development and tests. It accepts every email sent to it over the Simple Mail Transfer Protocol (SMTP), delivers none, shows them in a web UI and serves them through an HTTP API. In Szop it catches every email the API sends locally and in CI.

## Why Szop uses it

- **Real email without sending any:** [ADR 0078](../../decisions/0078-sending-email-phase-details.md), decision 3. The API sends real SMTP locally and in CI, through the same nodemailer code it uses with SES on AWS ([nodemailer](nodemailer.md)), and no message leaves the machine. Considered and rejected: printing emails to the console or writing them to a file "outbox", which shows no real email and makes the API and the tests share a disk.
- **Tests read the email:** the API tests, and from [PH-18b](../../roadmap.md#ph-18b-registration) the end-to-end journeys, find an email through Mailpit's API and read its sender, subject and body ([ADR 0007](../../decisions/0007-testing-strategy.md), decision 15).
- **One small container,** started with PostgreSQL by the same `compose.yaml`, so CI needs no change to run it.

## Configuration

The `mailpit` service in `compose.yaml` ([Docker Compose](docker-compose.md#configuration)):

- `image: axllent/mailpit:v1.34.0`: pinned by its tag, so Dependabot proposes updates as PRs.
- `ports`: `127.0.0.1:1025:1025`, SMTP, and `127.0.0.1:8025:8025`, the web UI and the HTTP API, both bound to the loopback address like PostgreSQL's, so only this machine reaches them.
- `networks: [default, prodlike]`: the `prodlike` profile has its own network, so Mailpit joins it too and one Mailpit serves every profile.
- `healthcheck`: `/mailpit readyz`, Mailpit's own readiness check, which `docker compose up --wait` waits for.
- No volume: email is kept in memory, and a restart empties it.

The API reaches it through its settings ([`apps/api/.env.example`](../../../apps/api/.env.example)): `EMAIL_TRANSPORT=smtp`, `SMTP_HOST=127.0.0.1`, not `localhost`, since Mailpit listens on IPv4 only and Node may try IPv6's `::1` first, and `SMTP_PORT=1025`. The containers of the image use `SMTP_HOST=mailpit`. Mailpit asks for no login and no TLS.

In a Docker Sandbox, `compose.sandbox.yaml` publishes the UI on every interface, so `sbx ports` can reach it from Windows ([the sbx runbook](../../operations/docker-sandbox.md#ports)).

## Everyday use

- **The UI:** <http://localhost:8025> lists every email; opening one shows its HTML, its text, its headers and its raw source.
- **The API**, which tests use: `GET /api/v1/search?query=to:<address>` finds messages, and `GET /api/v1/message/<id>` returns one with `From`, `To`, `Subject`, `Text` and `HTML`. The UI's *API* link documents the rest.
- **A test email:** `pnpm --filter api exec node --env-file=.env src/send-test-email.ts someone@example.com`, from the repository root, sends one through the app's own sender.
- **Emptying it:** the UI's *Delete all*, or `docker compose restart mailpit`. Tests never need it: each sends to an address of its own ([testing guide](../testing.md#writing-an-email-test)).
- **`ECONNREFUSED` on port 1025** in a test or the API's log: Mailpit is not running; start it with `pnpm db:up`.

## Official documentation

- Mailpit: <https://mailpit.axllent.org/docs/>
- Its API: <https://mailpit.axllent.org/docs/api-v1/>
- The image: <https://hub.docker.com/r/axllent/mailpit>
