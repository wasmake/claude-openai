# Claude OpenAI

Local OpenAI-compatible proxy for Claude Code CLI.

> **Warning:** OpenCode use is experimental and text-oriented. It is **not** full agent/tool compatibility: `tool_calls`, images, and many OpenAI extras are ignored.

## How it works

```
OpenAI client
   → loopback HTTP server
   → POST /v1/chat/completions
   → message/model conversion
   → fresh `claude` subprocess per request
   → stdin + `stream-json`
   → OpenAI JSON / SSE conversion
```

- The server is a loopback proxy; each request starts a new Claude CLI subprocess from the proxy cwd.
- Full conversation history is replayed every call; the server keeps no OpenAI chat state.
- `system` and `developer` messages are merged into Claude’s system prompt; prior `assistant` turns are sent back as context.
- Supported endpoints: `/health`, `/v1/models`, `/v1/chat/completions`, `/v1/usage`, `/v1/usage/recent`.
- Compatibility boundaries: no `tool_calls`, image parts are ignored, sampling params are ignored, and this is not the full OpenAI API.

## Setup, phase 1: Claude CLI first

1. Install Node.js **20+**.
2. Install or update Claude Code CLI to **>=2.1.197**.
3. Confirm both are on `PATH`:

```bash
node --version
claude --version
```

4. Sign in to Claude Code:

```bash
claude auth login
```

5. Smoke-test the CLI directly:

```bash
claude --print "Reply with exactly OK"
```

Startup logs and `/health` only prove the server is running; they do **not** prove Claude auth.

## Setup, phase 2: proxy

```bash
git clone https://github.com/wasmake/claude-openai.git
cd claude-openai
npm ci
npm run build
# .env.example is reference only; .env is not auto-loaded.
export CLAUDE_OPENAI_API_KEY='local-key'
export API_KEYS="$CLAUDE_OPENAI_API_KEY"
export DEBUG=''
npm start
```

- `API_KEYS` is proxy auth; it is separate from Claude auth.
- It accepts a comma-separated list; the client bearer token must match one entry exactly.
- Leave `API_KEYS` empty to disable proxy auth.
- Restart the proxy after changing env vars.
- Custom port: `npm start -- 4000`

Windows (direct env assignments only):

```powershell
git clone https://github.com/wasmake/claude-openai.git
Set-Location claude-openai
npm ci
npm run build
$env:CLAUDE_OPENAI_API_KEY='local-key'
$env:API_KEYS=$env:CLAUDE_OPENAI_API_KEY
$env:DEBUG=''
npm start
```

## Why use it

It lets OpenAI Chat Completions clients talk to a locally authenticated Claude CLI without changing their request shape.

For OpenCode, that means you can point a model entry at this proxy and keep using OpenCode’s existing OpenAI-compatible flow.

## Current models

Advertised GA model IDs:

- `claude-fable-5`
- `claude-opus-4-8`
- `claude-sonnet-5`
- `claude-haiku-4-5-20251001`

Aliases include `fable`, `opus`, `sonnet`, and `haiku`.

`/v1/models` is a support list, not an entitlement list; access still depends on your Claude subscription, account state, and Anthropic rollout.

## OpenCode

Use either global `~/.config/opencode/opencode.json` or project `./opencode.json` (project config can override global config).

`{env:CLAUDE_OPENAI_API_KEY}` reads the OpenCode process environment, so set it in the shell that launches OpenCode.

POSIX:

```bash
export CLAUDE_OPENAI_API_KEY='local-key'
```

PowerShell:

```powershell
$env:CLAUDE_OPENAI_API_KEY='local-key'
```

The JSON below is auth-enabled. If proxy auth is disabled, delete `options.apiKey` and keep `API_KEYS` empty.

Restart OpenCode after editing config.

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "claude-openai": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Claude OpenAI",
      "options": {
        "baseURL": "http://127.0.0.1:3456/v1",
        "apiKey": "{env:CLAUDE_OPENAI_API_KEY}"
      },
      "models": {
        "claude-sonnet-5": {
          "name": "Claude Sonnet 5",
          "tool_call": false
        }
      }
    }
  },
  "model": "claude-openai/claude-sonnet-5"
}
```

`tool_call:false` only describes OpenCode’s expectations. Claude CLI still runs with `--dangerously-skip-permissions` from the proxy working directory, outside OpenCode permissions/snapshots.

## Other tools

### curl

Health:

```bash
curl http://127.0.0.1:3456/health
```

Models:

```bash
curl -H "Authorization: Bearer $CLAUDE_OPENAI_API_KEY" http://127.0.0.1:3456/v1/models
```

Chat completions:

```bash
curl -X POST http://127.0.0.1:3456/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CLAUDE_OPENAI_API_KEY" \
  -d '{"model":"claude-openai/claude-sonnet-5","messages":[{"role":"user","content":"Hello"}]}'
```

Streaming:

```bash
curl -N -X POST http://127.0.0.1:3456/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CLAUDE_OPENAI_API_KEY" \
  -d '{"model":"claude-openai/claude-sonnet-5","stream":true,"messages":[{"role":"user","content":"Write one short haiku about rain."}]}'
```

### OpenAI JavaScript SDK

In a scratch directory:

```bash
mkdir client
cd client
npm init -y
npm install openai
```

```js
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "http://127.0.0.1:3456/v1",
  apiKey: process.env.CLAUDE_OPENAI_API_KEY || "local-dummy",
});

const completion = await client.chat.completions.create({
  model: "claude-openai/claude-sonnet-5",
  messages: [{ role: "user", content: "Say hello in one sentence." }],
});

console.log(completion.choices[0].message.content);
```

Save as `client.mjs`, then run `node client.mjs`.

### OpenAI Python SDK

In a separate scratch directory:

```bash
mkdir py-client
cd py-client
pip install openai
```

```python
import os
from openai import OpenAI

client = OpenAI(
    base_url="http://127.0.0.1:3456/v1",
    api_key=os.getenv("CLAUDE_OPENAI_API_KEY", "local-dummy"),
)

completion = client.chat.completions.create(
    model="claude-openai/claude-sonnet-5",
    messages=[{"role": "user", "content": "Say hello in one sentence."}],
)

print(completion.choices[0].message.content)
```

Save as `client.py` and run it directly. All clients should use `chat.completions`, a supported model ID, and a non-empty key value (dummy OK) when proxy auth is off; curl can omit the header in that mode.

## Security and limitations

- Loopback only; CORS is wide open for local development.
- Proxy auth is off by default unless `API_KEYS` is set.
- The spawned Claude CLI inherits the proxy environment and current working directory.
- The subprocess uses `--no-session-persistence` and `--dangerously-skip-permissions`.
- No TLS termination, no rate limiting, and no trust boundary enforcement here.
- Use only with trusted clients and a trusted working directory.
- Unofficial project; review Anthropic terms before use.

## Troubleshooting

- `claude` not found: install/update Claude Code and re-check `PATH`.
- Wrong version: upgrade to `>=2.1.197`.
- Auth failure: rerun `claude auth login`, then smoke-test with `claude --print "Reply with exactly OK"`.
- 401: proxy auth is enabled and the bearer token is wrong or missing.
- SDK rejects empty key: use a dummy non-empty key when proxy auth is off.
- Invalid model: use one of the advertised IDs or supported aliases.
- Port busy: restart on another port, e.g. `npm start -- 4000`.

## Provenance

Upstream source: `https://github.com/sethschnrt/claude-max-api-proxy.git`

Imported at commit `45cae61d97ad3f40bd0cad644c136a088541e30a`

MIT licensed.
