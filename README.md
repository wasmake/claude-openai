# Claude OpenAI

OpenAI-compatible local server + plugin for Claude Code CLI.

## Requirements

- Node.js 20 or newer
- Claude Code CLI `>=2.1.197`
- `node` and `claude` on your `PATH`
- Claude Code authenticated locally with `claude auth login`

Check versions first:

```bash
node --version
claude --version
```

PowerShell:

```powershell
node --version
claude --version
```

## Fresh-clone setup

1. Clone the repo.
2. Install dependencies with `npm ci`.
3. Build with `npm run build`.
4. Optionally copy `.env.example` to `.env`.
5. Explicitly load env vars yourself; this project does not auto-load `.env`.
6. This repo is private/source-only; the server is not distributed from npm.

POSIX shell:

```bash
git clone https://github.com/wasmake/claude-openai.git
cd claude-openai
npm ci
npm run build
if [ ! -e .env ]; then cp .env.example .env; fi   # optional template only
if [ -f .env ]; then
  # Sourcing executes shell code; only source trusted files.
  set -a
  . ./.env
  set +a
fi
npm start
```

PowerShell:

```powershell
git clone https://github.com/wasmake/claude-openai.git
Set-Location claude-openai
npm ci
npm run build
if (-not (Test-Path .env)) { Copy-Item .env.example .env }   # optional template only

# Or set env vars directly in this shell:
$env:API_KEYS = ''
$env:DEBUG = ''
npm start
```

Copying `.env.example` alone is not enough; there is no dotenv loader.

## Server start

- Default bind: `127.0.0.1:3456`
- Custom port: `npm start -- 4000`
- Standalone host is not configurable through env vars or CLI flags

Restart the server after changing env vars.

## Environment

`API_KEYS` enables proxy bearer auth when non-empty.

- Comma-separated Bearer keys are allowed.
- A client `API_KEY` must exactly match one comma-separated `API_KEYS` entry.
- Blank `API_KEYS=` disables auth.
- When enabled, `/v1/*` routes require `Authorization: Bearer <API_KEY>`.
- `/health` and `OPTIONS` preflight stay public.
- Claude Code auth is separate; you still need `claude auth login`.

`DEBUG` enables request logging when it is any non-empty value.

- `DEBUG=false` still enables logging.
- `DEBUG=0` still enables logging.
- Empty `DEBUG=` disables it.

## Claude Code auth smoke test

Run this after `claude auth login`:

```bash
claude --print "Reply with exactly OK"
```

Startup logs and `/health` do not prove Claude Code authentication; they only show the server is up and which auth mode is configured.

## Models

Current GA model IDs advertised by `/v1/models`:

- `claude-fable-5`
- `claude-opus-4-8`
- `claude-sonnet-5`
- `claude-haiku-4-5-20251001`

Aliases accepted as request inputs:

- `fable`
- `opus`
- `sonnet`
- `haiku`
- `claude-haiku-4-5`

Compatibility inputs also accepted but not advertised:

- `claude-opus-4`
- `claude-opus-4-6`
- `claude-sonnet-4`
- `claude-sonnet-4-5-20250929`
- `claude-haiku-4`

Supported prefixes: `claude-openai/`, `claude-code-cli/`, `anthropic/`, `claude-max/`.

`/v1/models` is a support list, not an entitlement list. Access still depends on your Claude subscription, account state, and Anthropic rollout.

### Pricing used for usage estimates

Verified from Anthropic sources on **2026-07-16**:

- Fable 5: `$10 / MTok in`, `$50 / MTok out`, cache `write $12.50`, `read $1`
- Opus 4.8: `$5 / MTok in`, `$25 / MTok out`, cache `write $6.25`, `read $0.50`
- Sonnet 5: `$2 / MTok in`, `$10 / MTok out` through 2026-08-31, then `$3 / $15`; cache `write $2.50/$3.75`, `read $0.20/$0.30`
- Haiku 4.5: `$1 / MTok in`, `$5 / MTok out`, cache `write $1.25`, `read $0.10`

These estimates are not billing.

Fable access may depend on your account/credits and rollout status.

## Request compatibility

- Send the full conversation history on every call; the server does not keep OpenAI chat state for you.
- Text-only compatibility: only text content is used from array parts; `image_url` parts are ignored.
- `system` and `developer` messages become the system prompt.
- Previous `assistant` messages are replayed as context.
- `temperature`, `max_tokens`, `top_p`, `frequency_penalty`, and `presence_penalty` are accepted but ignored.
- The OpenAI `user` field is used as a session id.

## Usage examples

Set `API_KEY` in the client terminal when auth is enabled. Use one exact value from `API_KEYS`. Leave `API_KEY` unset for public routes, or set a dummy non-empty value for SDKs when auth is disabled.

### Health

`/health` is always public:

```bash
curl http://127.0.0.1:3456/health
```

### Models

Auth disabled:

```bash
curl http://127.0.0.1:3456/v1/models
```

Auth enabled:

```bash
curl -H "Authorization: Bearer $API_KEY" http://127.0.0.1:3456/v1/models
```

Use `/v1/models` to verify that auth works when `API_KEYS` is enabled.

### Non-streaming chat

Auth disabled:

```bash
curl -X POST http://127.0.0.1:3456/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-openai/claude-sonnet-5","messages":[{"role":"user","content":"Hello"}]}'
```

Auth enabled:

```bash
curl -X POST http://127.0.0.1:3456/v1/chat/completions \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-openai/claude-sonnet-5","messages":[{"role":"user","content":"Hello"}]}'
```

### Streaming chat

Auth disabled:

```bash
curl -N -X POST http://127.0.0.1:3456/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-openai/claude-sonnet-5","stream":true,"messages":[{"role":"user","content":"Write one short haiku about rain."}]}'
```

Auth enabled:

```bash
curl -N -X POST http://127.0.0.1:3456/v1/chat/completions \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-openai/claude-sonnet-5","stream":true,"messages":[{"role":"user","content":"Write one short haiku about rain."}]}'
```

### Usage

Auth disabled:

```bash
curl http://127.0.0.1:3456/v1/usage
```

```bash
curl "http://127.0.0.1:3456/v1/usage?since=0"
```

Auth enabled:

```bash
curl -H "Authorization: Bearer $API_KEY" http://127.0.0.1:3456/v1/usage
```

### Recent usage

Auth disabled:

```bash
curl "http://127.0.0.1:3456/v1/usage/recent?limit=20"
```

Auth enabled:

```bash
curl -H "Authorization: Bearer $API_KEY" "http://127.0.0.1:3456/v1/usage/recent?limit=20"
```

## OpenAI SDK example

Create a separate client project or install `openai` in a scratch directory; do not add it to this server.

```bash
mkdir client
cd client
npm init -y
npm install openai
```

Save this as `client.mjs`:

```js
import OpenAI from "openai";

const API_KEY = process.env.API_KEY || "dummy-key";

const client = new OpenAI({
  baseURL: "http://127.0.0.1:3456/v1",
  apiKey: API_KEY,
});

const completion = await client.chat.completions.create({
  model: "claude-openai/claude-sonnet-5",
  messages: [{ role: "user", content: "Say hello in one sentence." }],
});

console.log(completion.choices[0].message.content);
```

Run it:

```bash
API_KEY=your-matching-key node client.mjs
```

If `API_KEYS` is disabled, any non-empty `API_KEY` works for the SDK.

## Scripts

- `npm run build` compiles TypeScript to `dist/`.
- `npm start` runs the already-built server from `dist/`; it does not rebuild.
- `npm run dev` runs the TypeScript compiler in watch mode only.
- `npm test` runs compiled tests from `dist/`, so build first.

## Plugin

Optional and host-dependent.

- Provider id: `claude-openai`
- Default model: `claude-openai/claude-sonnet-5`
- Optional host support: `clawdbot >=2026.1.0`

## Security and operations

- The server binds to loopback by default.
- CORS is wildcarded for local development.
- Auth is off by default unless `API_KEYS` is set.
- The spawned Claude CLI inherits the full process environment.
- Treat the working directory and calling client as trusted; the Claude CLI runs from the current working directory unless configured otherwise.
- The subprocess uses `--no-session-persistence` and `--dangerously-skip-permissions`.
- There is no TLS termination and no rate limiting here.
- Usage data is stored under `$HOME/.claude-openai/usage.json`; if `HOME` is unset it falls back to `/tmp/.claude-openai/usage.json`.
- Never commit `.env`.
- `DEBUG` is noisy; any non-empty value turns logging on.
- This is an unofficial project; review Anthropic terms before use.

## Troubleshooting

- `claude` not found: install/upgrade Claude Code and make sure it is on `PATH`.
- Wrong `claude` version: upgrade to `>=2.1.197` and re-check with `claude --version`.
- Auth failure: run `claude auth login`, then verify with `claude --print "Reply with exactly OK"`.
- Build/test failures: run `npm ci` and `npm run build` before `npm test`.
- Port already in use: start with another port, for example `npm start -- 4000`.
- HTTP 401: `API_KEYS` is enabled and the bearer token is missing or wrong.
- SDK rejects an empty key: use a dummy non-empty key when proxy auth is disabled.
- Invalid/unavailable model: use one of the advertised IDs, aliases, or supported compatibility IDs.

## Caveats

- Unofficial project; not affiliated with or endorsed by Anthropic.
- Claude is a trademark of Anthropic PBC.
- Review Anthropic terms before use.
- Security-wise, the server uses `spawn()` with an argument array, not a shell.

## Provenance

Imported from upstream `https://github.com/sethschnrt/claude-max-api-proxy.git` at commit:

`45cae61d97ad3f40bd0cad644c136a088541e30a`

MIT licensed.
