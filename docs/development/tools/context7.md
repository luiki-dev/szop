# context7

context7 is a documentation service for AI assistants, run by Upstash. Szop uses it as an **MCP server** ([Model Context Protocol](../../glossary.md), MCP): Claude Code asks it for the current documentation of a library and gets back the relevant pages and code examples, instead of answering from what it remembers from training.

## Contents

- [Why Szop uses it](#why-szop-uses-it)
- [The configuration](#the-configuration)
- [Approval](#approval)
- [What is sent](#what-is-sent)
- [Rate limit](#rate-limit)
- [Official documentation](#official-documentation)

## Why Szop uses it

[ADR 0056](../../decisions/0056-claude-code-tooling.md), decision 2. Several libraries in the stack are new majors (React Router 8, Vite 8, Tailwind CSS 4, Zod 4, ESLint 10, TypeScript 6), and a model's memory of them is often of the older version. Configuring the server in the repository gives every session the current documentation, cloud sessions included.

## The configuration

`.mcp.json` at the repository root:

- **`mcpServers.context7`:** the name the server is listed under (`claude mcp list`).
- **`type: "http"`:** Claude Code connects to a remote server over HTTP; nothing is installed or started locally.
- **`url`:** `https://mcp.context7.com/mcp`, the address context7's README gives.
- **No API key:** none is configured, so nothing secret is committed.

## Approval

Claude Code asks once per machine before it uses a project MCP server from `.mcp.json`. The owner approves context7 when it asks. Until then `claude mcp list` shows it as awaiting approval.

## What is sent

Library names and questions only, never code or secrets. The host `mcp.context7.com` must be reachable; in a cloud session the owner adds it to the cloud environment's *Network access* setting (it is in [the paste list of the setup guide](../setup.md#all-hosts-to-paste)).

## Rate limit

Without a key the rate limit is lower. That is enough for the occasional lookups a session makes. A free key from context7's dashboard raises it, if it ever becomes a problem.

## Official documentation

- Repository and README: <https://github.com/upstash/context7>
