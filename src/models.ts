import type { OpenAIModel } from "./types/openai.js";

export const MODEL_FAMILIES = ["fable", "opus", "sonnet", "haiku"] as const;
export type ModelFamily = (typeof MODEL_FAMILIES)[number];
export type ClaudeModel = ModelFamily;

export const SUPPORTED_MODEL_PREFIXES = [
  "claude-openai",
  "claude-code-cli",
  "anthropic",
  "claude-max",
] as const;

const SUPPORTED_PREFIX_SET = new Set<string>(SUPPORTED_MODEL_PREFIXES);

export interface ModelPricing {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export interface ModelPricingPeriod {
  effectiveFrom: number;
  pricing: ModelPricing;
}

export interface ModelCapabilities {
  contextWindow: number;
  maxOutputTokens: number;
  reasoning: boolean;
  extendedThinking: boolean;
}

export interface ModelRegistryEntry {
  id: string;
  canonicalId: string;
  displayName: string;
  family: ModelFamily;
  cliAlias: ClaudeModel;
  advertised: boolean;
  aliases: readonly string[];
  capabilities: ModelCapabilities;
  pricing: readonly ModelPricingPeriod[];
}

export interface ResolvedModel {
  requestedModel: string;
  canonicalModelId: string;
  displayName: string;
  family: ModelFamily;
  cliAlias: ClaudeModel;
  advertised: boolean;
  capabilities: ModelCapabilities;
}

const SONNET_5_INTRO_END = Date.UTC(2026, 8, 1);

const CURRENT_MODELS: readonly ModelRegistryEntry[] = [
  {
    id: "claude-fable-5",
    canonicalId: "claude-fable-5",
    displayName: "Claude Fable 5",
    family: "fable",
    cliAlias: "fable",
    advertised: true,
    aliases: ["fable"],
    capabilities: {
      contextWindow: 1_000_000,
      maxOutputTokens: 128_000,
      reasoning: true,
      extendedThinking: false,
    },
    pricing: [
      {
        effectiveFrom: 0,
        pricing: { input: 10, output: 50, cacheRead: 1, cacheWrite: 12.5 },
      },
    ],
  },
  {
    id: "claude-opus-4-8",
    canonicalId: "claude-opus-4-8",
    displayName: "Claude Opus 4.8",
    family: "opus",
    cliAlias: "opus",
    advertised: true,
    aliases: ["opus", "claude-opus-4", "claude-opus-4-6"],
    capabilities: {
      contextWindow: 1_000_000,
      maxOutputTokens: 128_000,
      reasoning: true,
      extendedThinking: false,
    },
    pricing: [
      {
        effectiveFrom: 0,
        pricing: { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
      },
    ],
  },
  {
    id: "claude-sonnet-5",
    canonicalId: "claude-sonnet-5",
    displayName: "Claude Sonnet 5",
    family: "sonnet",
    cliAlias: "sonnet",
    advertised: true,
    aliases: ["sonnet", "claude-sonnet-4", "claude-sonnet-4-5-20250929"],
    capabilities: {
      contextWindow: 1_000_000,
      maxOutputTokens: 128_000,
      reasoning: true,
      extendedThinking: false,
    },
    pricing: [
      {
        effectiveFrom: 0,
        pricing: { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
      },
      {
        effectiveFrom: SONNET_5_INTRO_END,
        pricing: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
      },
    ],
  },
  {
    id: "claude-haiku-4-5-20251001",
    canonicalId: "claude-haiku-4-5-20251001",
    displayName: "Claude Haiku 4.5",
    family: "haiku",
    cliAlias: "haiku",
    advertised: true,
    aliases: ["haiku", "claude-haiku-4-5", "claude-haiku-4"],
    capabilities: {
      contextWindow: 200_000,
      maxOutputTokens: 64_000,
      reasoning: true,
      extendedThinking: true,
    },
    pricing: [
      {
        effectiveFrom: 0,
        pricing: { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
      },
    ],
  },
] as const;

const COMPATIBILITY_ONLY_MODELS: readonly Omit<ModelRegistryEntry, "capabilities" | "pricing" | "advertised">[] = [
  {
    id: "claude-opus-4",
    canonicalId: "claude-opus-4-8",
    displayName: "Claude Opus 4",
    family: "opus",
    cliAlias: "opus",
    aliases: [],
  },
  {
    id: "claude-opus-4-6",
    canonicalId: "claude-opus-4-8",
    displayName: "Claude Opus 4.6",
    family: "opus",
    cliAlias: "opus",
    aliases: [],
  },
  {
    id: "claude-sonnet-4",
    canonicalId: "claude-sonnet-5",
    displayName: "Claude Sonnet 4",
    family: "sonnet",
    cliAlias: "sonnet",
    aliases: [],
  },
  {
    id: "claude-sonnet-4-5-20250929",
    canonicalId: "claude-sonnet-5",
    displayName: "Claude Sonnet 4.5",
    family: "sonnet",
    cliAlias: "sonnet",
    aliases: [],
  },
  {
    id: "claude-haiku-4",
    canonicalId: "claude-haiku-4-5-20251001",
    displayName: "Claude Haiku 4",
    family: "haiku",
    cliAlias: "haiku",
    aliases: [],
  },
  {
    id: "claude-haiku-4-5",
    canonicalId: "claude-haiku-4-5-20251001",
    displayName: "Claude Haiku 4.5",
    family: "haiku",
    cliAlias: "haiku",
    aliases: [],
  },
] as const;

const MODEL_LOOKUP = new Map<string, ModelRegistryEntry>();

function registerEntry(entry: ModelRegistryEntry): void {
  MODEL_LOOKUP.set(entry.id, entry);
  MODEL_LOOKUP.set(entry.canonicalId, entry.canonicalId === entry.id ? entry : { ...entry, advertised: false });

  for (const alias of entry.aliases) {
    MODEL_LOOKUP.set(alias, {
      ...entry,
      id: alias,
      advertised: false,
      aliases: [],
    });
  }
}

for (const entry of CURRENT_MODELS) {
  registerEntry(entry);
}

for (const entry of COMPATIBILITY_ONLY_MODELS) {
  MODEL_LOOKUP.set(entry.id, {
    ...entry,
    advertised: false,
    capabilities: getModelEntry(entry.canonicalId).capabilities,
    pricing: getModelEntry(entry.canonicalId).pricing,
  } satisfies ModelRegistryEntry);
}

function getModelEntry(modelId: string): ModelRegistryEntry {
  const found = MODEL_LOOKUP.get(modelId);
  if (!found) {
    throw new Error(`Unknown model: ${modelId}`);
  }
  return found;
}

export function resolveModel(input: unknown): ResolvedModel | null {
  if (typeof input !== "string" || input.length === 0 || input.trim() !== input) {
    return null;
  }

  const parts = input.split("/");
  if (parts.length > 2) {
    return null;
  }

  const modelId = parts.length === 2 ? parsePrefixedModel(parts) : input;
  if (!modelId) {
    return null;
  }

  const entry = MODEL_LOOKUP.get(modelId);
  if (!entry) {
    return null;
  }

  const canonical = MODEL_LOOKUP.get(entry.canonicalId) ?? entry;

  return {
    requestedModel: input,
    canonicalModelId: canonical.canonicalId,
    displayName: canonical.displayName,
    family: canonical.family,
    cliAlias: canonical.cliAlias,
    advertised: canonical.advertised && entry.id === canonical.id,
    capabilities: canonical.capabilities,
  };
}

function parsePrefixedModel(parts: string[]): string | null {
  const [prefix, modelId] = parts;
  if (!prefix || !modelId) {
    return null;
  }
  if (!SUPPORTED_PREFIX_SET.has(prefix)) {
    return null;
  }
  if (modelId.includes("/")) {
    return null;
  }
  return modelId;
}

export function listAdvertisedModels(): OpenAIModel[] {
  return CURRENT_MODELS.filter((model) => model.advertised).map((model) => ({
    id: model.id,
    object: "model",
    owned_by: "anthropic",
  }));
}

export const ADVERTISED_MODEL_IDS = listAdvertisedModels().map((model) => model.id);

export function getModelDisplayName(modelId: string): string | undefined {
  return resolveModel(modelId)?.displayName;
}

export function getCurrentModels(): readonly ModelRegistryEntry[] {
  return CURRENT_MODELS.filter((model) => model.advertised);
}

export function getEffectivePricing(modelId: string, atMs: number = Date.now()): ModelPricing {
  const resolved = resolveModel(modelId);
  if (!resolved) {
    throw new Error(`Unknown model: ${modelId}`);
  }

  const entry = MODEL_LOOKUP.get(resolved.canonicalModelId);
  if (!entry) {
    throw new Error(`Unknown model: ${modelId}`);
  }

  let active = entry.pricing[0];
  for (const period of entry.pricing) {
    if (atMs >= period.effectiveFrom) {
      active = period;
    }
  }
  return active.pricing;
}
