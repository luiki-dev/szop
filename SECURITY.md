# Security policy

Szop is a hobby and learning project run by one person. Reports are welcome and are handled on a best-effort basis; there is no bug bounty.

## Reporting a vulnerability

Report it privately through GitHub: the repository's **Security** tab → **Report a vulnerability**. Please do not open a public issue or pull request for it.

Say what is affected, how to reproduce it and what an attacker could gain. You will get an answer when the owner has read it, usually within a week.

## In scope

- The code in this repository: the app (`apps/`, `packages/`), the workflows (`.github/`) and the infrastructure (`infra/`).
- The demo at `https://szop.dzwoniec.com` and the landing page at `https://dzwoniec.com`, when they are up.

## Out of scope

- Denial of service against the demo, load tests and automated scanning that floods it.
- Social engineering, phishing and physical attacks.
- Flaws in third-party services and dependencies that are already public; report those upstream.
- Findings that need a compromised device or account of the owner.
