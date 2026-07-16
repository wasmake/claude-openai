import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ADVERTISED_MODEL_IDS,
  getEffectivePricing,
  listAdvertisedModels,
  resolveModel,
  SUPPORTED_MODEL_PREFIXES,
} from "./models.js";

describe("model registry", () => {
  it("advertises the current GA models exactly once", () => {
    const models = listAdvertisedModels();
    assert.deepEqual(models.map((m) => m.id), [
      "claude-fable-5",
      "claude-opus-4-8",
      "claude-sonnet-5",
      "claude-haiku-4-5-20251001",
    ]);
    assert.equal(models.every((m) => m.object === "model" && m.owned_by === "anthropic"), true);
    assert.deepEqual(ADVERTISED_MODEL_IDS, models.map((m) => m.id));
  });

  it("resolves GA ids, aliases, and supported prefixes", () => {
    const cases: Array<[unknown, string, string, boolean]> = [
      ["claude-fable-5", "fable", "claude-fable-5", true],
      ["claude-opus-4-8", "opus", "claude-opus-4-8", true],
      ["claude-sonnet-5", "sonnet", "claude-sonnet-5", true],
      ["claude-haiku-4-5-20251001", "haiku", "claude-haiku-4-5-20251001", true],
      ["fable", "fable", "claude-fable-5", false],
      ["opus", "opus", "claude-opus-4-8", false],
      ["sonnet", "sonnet", "claude-sonnet-5", false],
      ["haiku", "haiku", "claude-haiku-4-5-20251001", false],
      ["claude-haiku-4-5", "haiku", "claude-haiku-4-5-20251001", false],
      ["claude-openai/claude-sonnet-5", "sonnet", "claude-sonnet-5", true],
      ["claude-code-cli/claude-haiku-4-5", "haiku", "claude-haiku-4-5-20251001", false],
      ["anthropic/claude-opus-4-6", "opus", "claude-opus-4-8", false],
      ["claude-max/claude-opus-4", "opus", "claude-opus-4-8", false],
    ];

    for (const [input, family, canonicalModelId, advertised] of cases) {
      const resolved = resolveModel(input);
      assert.ok(resolved, String(input));
      assert.equal(resolved?.family, family);
      assert.equal(resolved?.canonicalModelId, canonicalModelId);
      assert.equal(resolved?.cliAlias, family);
      assert.equal(resolved?.advertised, advertised);
    }
  });

  it("rejects unsupported ids, bad prefixes, and non-string input", () => {
    for (const input of [
      "gpt-4o",
      "unknown",
      "best",
      "claude-mythos-5",
      "claude-openai/",
      "claude-openai//claude-opus-4-8",
      "claude-openai/claude-openai/claude-opus-4-8",
      "claude-bad/claude-opus-4-8",
      "",
      " ",
      null,
      undefined,
      42,
    ]) {
      assert.equal(resolveModel(input as never), null, String(input));
    }
  });

  it("classifies pricing by family explicitly", () => {
    assert.deepEqual(getEffectivePricing("claude-fable-5", Date.UTC(2026, 6, 16)), { input: 10, output: 50, cacheRead: 1, cacheWrite: 12.5 });
    assert.deepEqual(getEffectivePricing("claude-opus-4-8", Date.UTC(2026, 6, 16)), { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 });
    assert.deepEqual(getEffectivePricing("claude-sonnet-5", Date.UTC(2026, 6, 16)), { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 });
    assert.deepEqual(getEffectivePricing("claude-haiku-4-5-20251001", Date.UTC(2026, 6, 16)), { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 });
    assert.deepEqual(getEffectivePricing("claude-sonnet-5", Date.UTC(2026, 8, 1)), { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 });
    assert.deepEqual(SUPPORTED_MODEL_PREFIXES, ["claude-openai", "claude-code-cli", "anthropic", "claude-max"]);
  });
});
