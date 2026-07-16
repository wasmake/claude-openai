/**
 * Usage Tracker
 *
 * Tracks token usage, request counts, and estimated cost savings.
 * Persists to disk so usage data survives restarts.
 */

import fs from "fs/promises";
import path from "path";
import { getEffectivePricing, resolveModel } from "../models.js";

export interface RequestRecord {
  timestamp: number;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  durationMs: number;
  estimatedApiCostUsd: number;
  stream: boolean;
  success: boolean;
}

export interface UsageSummary {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheWriteTokens: number;
  estimatedApiCostSavedUsd: number;
  avgResponseMs: number;
  byModel: Record<string, {
    requests: number;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
  }>;
  since: number;
  lastRequest: number | null;
}

// Official Anthropic API pricing verified 2026-07-16:
// https://docs.anthropic.com/en/docs/about-claude/models
// https://www.anthropic.com/pricing
// Fable 5: $10/$50, Opus 4.8: $5/$25, Sonnet 5: $2/$10 intro through 2026-08-31,
// Haiku 4.5: $1/$5.

const DEFAULT_DATA_DIR = path.join(
  process.env.HOME || "/tmp",
  ".claude-openai"
);

export class UsageTracker {
  private records: RequestRecord[] = [];
  private dataDir: string;
  private loaded = false;
  private saveDebounce: NodeJS.Timeout | null = null;
  private startedAt: number;

  constructor(dataDir?: string) {
    this.dataDir = dataDir || DEFAULT_DATA_DIR;
    this.startedAt = Date.now();
  }

  async load(): Promise<void> {
    if (this.loaded) return;

    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      const filePath = path.join(this.dataDir, "usage.json");
      const data = await fs.readFile(filePath, "utf-8");
      const parsed = JSON.parse(data);
      this.records = parsed.records || [];
      this.startedAt = parsed.startedAt || Date.now();
      this.loaded = true;
    } catch {
      this.records = [];
      this.loaded = true;
    }
  }

  /**
   * Record a completed request
   */
  record(entry: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
    durationMs: number;
    stream: boolean;
    success: boolean;
    recordedAtMs?: number;
  }): void {
    const resolved = resolveModel(entry.model);
    const pricingKey = resolved?.family ?? "unknown";
    const pricing = resolved ? getEffectivePricing(resolved.canonicalModelId, entry.recordedAtMs) : { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
    const estimatedCost =
      (entry.inputTokens / 1_000_000) * pricing.input +
      (entry.outputTokens / 1_000_000) * pricing.output +
      (entry.cacheReadTokens || 0) * (pricing.cacheRead / 1_000_000) +
      (entry.cacheWriteTokens || 0) * (pricing.cacheWrite / 1_000_000);

    const record: RequestRecord = {
      timestamp: Date.now(),
      model: pricingKey,
      inputTokens: entry.inputTokens,
      outputTokens: entry.outputTokens,
      cacheReadTokens: entry.cacheReadTokens || 0,
      cacheWriteTokens: entry.cacheWriteTokens || 0,
      durationMs: entry.durationMs,
      estimatedApiCostUsd: estimatedCost,
      stream: entry.stream,
      success: entry.success,
    };

    this.records.push(record);
    this.debouncedSave();
  }

  /**
   * Get usage summary
   */
  getSummary(since?: number): UsageSummary {
    const cutoff = since || 0;
    const filtered = this.records.filter(r => r.timestamp >= cutoff);

    const summary: UsageSummary = {
      totalRequests: filtered.length,
      successfulRequests: filtered.filter(r => r.success).length,
      failedRequests: filtered.filter(r => !r.success).length,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCacheReadTokens: 0,
      totalCacheWriteTokens: 0,
      estimatedApiCostSavedUsd: 0,
      avgResponseMs: 0,
      byModel: {},
      since: this.startedAt,
      lastRequest: filtered.length > 0 ? filtered[filtered.length - 1].timestamp : null,
    };

    let totalDuration = 0;

    for (const r of filtered) {
      summary.totalInputTokens += r.inputTokens;
      summary.totalOutputTokens += r.outputTokens;
      summary.totalCacheReadTokens += r.cacheReadTokens;
      summary.totalCacheWriteTokens += r.cacheWriteTokens;
      summary.estimatedApiCostSavedUsd += r.estimatedApiCostUsd;
      totalDuration += r.durationMs;

      if (!summary.byModel[r.model]) {
        summary.byModel[r.model] = {
          requests: 0,
          inputTokens: 0,
          outputTokens: 0,
          estimatedCostUsd: 0,
        };
      }
      summary.byModel[r.model].requests++;
      summary.byModel[r.model].inputTokens += r.inputTokens;
      summary.byModel[r.model].outputTokens += r.outputTokens;
      summary.byModel[r.model].estimatedCostUsd += r.estimatedApiCostUsd;
    }

    summary.avgResponseMs = filtered.length > 0
      ? Math.round(totalDuration / filtered.length)
      : 0;

    // Round cost to 4 decimal places
    summary.estimatedApiCostSavedUsd = Math.round(summary.estimatedApiCostSavedUsd * 10000) / 10000;
    for (const model of Object.values(summary.byModel)) {
      model.estimatedCostUsd = Math.round(model.estimatedCostUsd * 10000) / 10000;
    }

    return summary;
  }

  /**
   * Get recent requests (last N)
   */
  getRecent(limit: number = 20): RequestRecord[] {
    return this.records.slice(-limit);
  }

  /**
   * Clear all usage data
   */
  async clear(): Promise<void> {
    this.records = [];
    this.startedAt = Date.now();
    await this.save();
  }

  private debouncedSave(): void {
    if (this.saveDebounce) clearTimeout(this.saveDebounce);
    this.saveDebounce = setTimeout(() => this.save(), 5000);
    this.saveDebounce.unref?.();
  }

  private async save(): Promise<void> {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      const filePath = path.join(this.dataDir, "usage.json");
      await fs.writeFile(filePath, JSON.stringify({
        startedAt: this.startedAt,
        records: this.records,
      }, null, 2));
    } catch (err) {
      console.error("[UsageTracker] Save error:", err);
    }
  }
}

// Singleton
export const usageTracker = new UsageTracker();
