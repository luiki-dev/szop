# Working in this Docker Sandbox

- **The visual companion** (superpowers' brainstorming server): start it with `--host 0.0.0.0 --url-host localhost`. `BRAINSTORM_PORT` is fixed at 61935 and that port is published to the host, so the owner opens the URL in a Windows browser. A browser cannot be opened from here: give the owner the URL.
- **The network** goes through a proxy that answers a blocked request with `403`: call `curl` with `--fail`. A host that is not allowed waits for the owner's approval in `sbx`; say which host and why.
- **Credentials** are placeholders (`GH_TOKEN`, the Claude login); the proxy puts the real values in. Never print them or ask for real ones. `gh` and `git push` act as the machine account.
- **AWS:** only the profile `claude-readonly`. Its login is the owner's: `aws sso login --use-device-code --profile claude-readonly`.
- **Isolation checks:** `check-sandbox` runs them and names any that fail.
