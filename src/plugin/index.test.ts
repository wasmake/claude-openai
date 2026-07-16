import { describe, it } from "node:test";
import assert from "node:assert/strict";
import plugin, { AVAILABLE_MODELS, DEFAULT_MODEL, PROVIDER_ID, buildModelDefinition } from "../index.js";

function createApi() {
  const commands: string[] = [];
  const provider: any[] = [];
  return {
    commands,
    provider,
    registerProvider(def: unknown) {
      provider.push(def);
    },
    registerCli(register: (cli: any) => void) {
      register({
        command(name: string) {
          commands.push(name);
          return {
            description() {
              return this;
            },
            action() {
              return this;
            },
          };
        },
      });
    },
    on() {
      return undefined;
    },
  };
}

describe("plugin registry", () => {
  it("exposes all current models with accurate capabilities and default model", () => {
    const defs = AVAILABLE_MODELS.map(buildModelDefinition);
    assert.equal(DEFAULT_MODEL, "claude-openai/claude-sonnet-5");
    assert.deepEqual(defs.map((d) => d.id), [
      "claude-fable-5",
      "claude-opus-4-8",
      "claude-sonnet-5",
      "claude-haiku-4-5-20251001",
    ]);
    assert.deepEqual(defs.map((d) => d.contextWindow), [1_000_000, 1_000_000, 1_000_000, 200_000]);
    assert.deepEqual(defs.map((d) => d.maxTokens), [128_000, 128_000, 128_000, 64_000]);
    assert.deepEqual(defs.map((d) => d.reasoning), [true, true, true, true]);
    assert.deepEqual(defs.map((d) => d.extendedThinking), [false, false, false, true]);
  });

  it("registers compatibility CLI aliases alongside the new names", () => {
    const api = createApi();
    plugin.register(api as never);

    assert.equal(api.provider[0].id, PROVIDER_ID);
    assert.deepEqual(api.provider[0].aliases, ["claude-cli", "claude-code-cli", "claude-max"]);
    assert.deepEqual(api.commands, [
      "claude-openai:start [port]",
      "claude-code-cli:start [port]",
      "claude-cli:start [port]",
      "claude-openai:stop",
      "claude-code-cli:stop",
      "claude-cli:stop",
      "claude-openai:status",
      "claude-code-cli:status",
      "claude-cli:status",
    ]);
  });
});
