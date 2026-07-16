import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { UsageTracker } from "./tracker.js";

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "claude-openai-test-"));
}

describe("usage tracker pricing", () => {
  it("includes cache pricing and classifies usage by family", async () => {
    const tracker = new UsageTracker(makeTempDir());
    tracker.record({
      model: "claude-openai/claude-fable-5",
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      cacheReadTokens: 1_000_000,
      cacheWriteTokens: 1_000_000,
      durationMs: 10,
      stream: false,
      success: true,
      recordedAtMs: Date.UTC(2026, 6, 16),
    });

    const summary = tracker.getSummary();
    assert.equal(summary.byModel.fable.requests, 1);
    assert.equal(summary.byModel.fable.estimatedCostUsd, 73.5);
    assert.equal(summary.totalCacheReadTokens, 1_000_000);
    assert.equal(summary.totalCacheWriteTokens, 1_000_000);
  });

  it("uses Sonnet 5 introductory pricing before 2026-09-01 and standard pricing after", async () => {
    const tracker = new UsageTracker(makeTempDir());

    tracker.record({
      model: "claude-sonnet-5",
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      cacheReadTokens: 1_000_000,
      cacheWriteTokens: 1_000_000,
      durationMs: 10,
      stream: false,
      success: true,
      recordedAtMs: Date.UTC(2026, 6, 16),
    });

    tracker.record({
      model: "claude-sonnet-5",
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      cacheReadTokens: 1_000_000,
      cacheWriteTokens: 1_000_000,
      durationMs: 10,
      stream: false,
      success: true,
      recordedAtMs: Date.UTC(2026, 8, 1),
    });

    const recent = tracker.getRecent(2);
    assert.equal(recent[0].estimatedApiCostUsd, 14.7);
    assert.equal(recent[1].estimatedApiCostUsd, 22.05);
  });
});
