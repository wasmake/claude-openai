# Claude OpenAI

OpenAI-compatible local server + plugin for Claude Code CLI.

## Requirements

- Node.js 20+
- Claude Code `>=2.1.197` for the full current lineup
- Claude Code authenticated locally

## Install from source

```bash
git clone https://github.com/wasmake/claude-openai.git
cd claude-openai
npm ci
npm run build
npm start
```

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

`/v1/models` is a support list, not an entitlement list. Model access still depends on your Claude subscription, account state, and Anthropic rollout.

## Pricing used for usage estimates

Verified from Anthropic sources on **2026-07-16**:

- Fable 5: `$10 / MTok in`, `$50 / MTok out`, cache `write $12.50`, `read $1`
- Opus 4.8: `$5 / MTok in`, `$25 / MTok out`, cache `write $6.25`, `read $0.50`
- Sonnet 5: `$2 / MTok in`, `$10 / MTok out` through 2026-08-31, then `$3 / $15`; cache `write $2.50/$3.75`, `read $0.20/$0.30`
- Haiku 4.5: `$1 / MTok in`, `$5 / MTok out`, cache `write $1.25`, `read $0.10`

Sources: Anthropic models overview and pricing pages. These estimates are not billing.

## Usage

```bash
### Terminal 1
npm start

### Terminal 2
curl http://localhost:3456/v1/models

curl -X POST http://localhost:3456/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-openai/claude-sonnet-5","messages":[{"role":"user","content":"Hello"}]}'
```

## Plugin

- Provider id: `claude-openai`
- Default model: `claude-openai/claude-sonnet-5`
- Exposes all four GA models

## Caveats

- Unofficial project; not affiliated with or endorsed by Anthropic.
- Claude is a trademark of Anthropic PBC.
- Review Anthropic terms before use.
- Fable access may depend on your account/credits and rollout status.
- Security-wise, the server uses `spawn()` with an argument array, not a shell.

## Provenance

Imported from upstream `https://github.com/sethschnrt/claude-max-api-proxy.git` at commit:

`45cae61d97ad3f40bd0cad644c136a088541e30a`

MIT licensed.
