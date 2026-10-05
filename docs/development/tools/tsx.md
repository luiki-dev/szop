# tsx

tsx runs TypeScript files directly: it compiles each one with esbuild on the fly and hands the result to Node. Its `watch` mode restarts the program whenever a file it uses changes. In Szop it runs the API in development.

## Why Szop uses it

- **tsx in watch mode:** [ADR 0005](../../decisions/0005-development-environment.md), decision 9. It restarts the API on every change. Node 24 can run TypeScript itself by stripping the types, but it rejects some syntax and has rough edges with path resolution and workspace packages; compiling with `tsc` before every run is slow.
- **It does not check types.** Neither tsx nor Node does; `pnpm typecheck` does ([TypeScript](typescript.md)).

## Configuration

tsx has no configuration of its own. What matters is the `dev` script in `apps/api/package.json`:

```
tsx watch --env-file=.env src/server.ts | pino-pretty
```

- `tsx watch`: run the file and restart it on every change to it or to anything it imports.
- `--env-file=.env`: tsx does not know this flag and passes it on to Node, which reads `.env` into `process.env` before the program starts. It is relative to where the script runs, `apps/api`. A missing file makes Node stop with `node: .env: not found`.
- `src/server.ts`: the file to run, the API's entry point.
- `| pino-pretty`: a shell pipe that makes the log readable; see [pino-pretty](pino-pretty.md).

**`allowBuilds: { esbuild: false }`** in `pnpm-workspace.yaml`: tsx depends on esbuild, whose install script pnpm would otherwise stop on with `ERR_PNPM_IGNORED_BUILDS`. The script only checks the binary that the optional `@esbuild/<platform>` package already installs, so it is denied: allowing it would run code from the internet at install time for no gain. See [pnpm](pnpm.md).

## Everyday use

```bash
pnpm dev                                                  # from the root: start the API and restart it on changes
cd apps/api && pnpm exec tsx --env-file=.env src/server.ts   # run it once, without watch and without pino-pretty
```

- **A restart** after saving a file looks like this in the log: tsx prints `[tsx] change in ./src/app.ts Restarting...`, the old server logs `shutting down` with `signal: "SIGTERM"`, and the new one logs `Server listening`.
- **Stop with Ctrl+C.** The server logs `shutting down` with `signal: "SIGINT"` and pnpm prints `Done`.
- **Typing `rs` and Enter, nodemon's way of forcing a restart, does not work:** `pnpm -r --parallel` gives its scripts no input.
- **A failed start does not exit `pnpm dev`.** With a missing `.env`, a taken port or an invalid setting, `tsx watch` prints the error and then waits for a file change; fix the cause and save, or press Ctrl+C. Run once, the same server does exit: code 1 for an invalid setting or `EADDRINUSE` (the port is taken, shown as Node's raw error), and code 9 with `node: .env: not found` for a missing `.env`.
- **`Invalid configuration`** lists each wrong or missing variable by name; compare `.env` with `.env.example`.

## Official documentation

- tsx: <https://tsx.is/>
- Watch mode: <https://tsx.is/watch-mode>
- Node's `--env-file`: <https://nodejs.org/api/cli.html#--env-fileconfig>
