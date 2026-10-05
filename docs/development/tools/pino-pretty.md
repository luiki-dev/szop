# pino-pretty

pino-pretty turns the JSON lines that Fastify's logger (pino) writes into coloured, readable ones. In Szop it reads the API's log in development.

## Why Szop uses it

- **A pipe in the `dev` script only:** [ADR 0019](../../decisions/0019-api-skeleton-details.md), decision 3. The app itself always writes JSON, one object per line, so production gets exactly what CloudWatch (AWS's log service) reads, and the code has no development-only branch. Considered and rejected: pino's `transport` setting, which puts the prettifying into the app's configuration, and raw JSON in development, which is hard to read.

## Configuration

None of its own: it runs with its defaults. It is the last part of the `dev` script in `apps/api/package.json`:

```
tsx watch --env-file=.env src/server.ts | pino-pretty
```

The `|` sends the server's output into pino-pretty's input. That makes the script's exit status pino-pretty's, not the server's. See [tsx](tsx.md) for the rest of the script.

## Everyday use

Every request logs two lines with the same `reqId`: `incoming request`, with the method, the URL and where it came from, and `request completed`, with the status code and the response time in milliseconds. At startup there is one more, `Server listening at http://127.0.0.1:3000`.

```
[18:41:48.819] INFO (1320666): incoming request
    reqId: "req-1"
    req: {
      "method": "GET",
      "url": "/api/health",
      "host": "127.0.0.1:3000",
      "remoteAddress": "127.0.0.1",
      "remotePort": 47544
    }
[18:41:48.823] INFO (1320666): request completed
    reqId: "req-1"
    res: {
      "statusCode": 200
    }
    responseTime: 3.291302000000087
```

The time, the level and the process number come first on each line; the number in brackets is the process id and changes on every restart.

- **An unknown path**, such as `/api/nope`, answers Fastify's default `{"message":"Route GET:/api/nope not found","error":"Not Found","statusCode":404}`. Its log has an extra info line, `Route GET:/api/nope not found`, between the two.
- **The raw JSON:** run the server without the pipe, from `apps/api`: `pnpm exec tsx --env-file=.env src/server.ts`. That is what production writes.
- **More or less detail:** set `LOG_LEVEL` in `.env` (`fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent`) and restart. `debug` adds what `info` leaves out.

## Official documentation

- pino-pretty: <https://github.com/pinojs/pino-pretty>
- Fastify's logging: <https://fastify.dev/docs/latest/Reference/Logging/>
- pino's log levels: <https://getpino.io/#/docs/api?id=level-string>
