/**
 * Converts OpenAI chat request format to Claude CLI input
 */

import type { OpenAIChatRequest, OpenAIContentPart } from "../types/openai.js";
import { resolveModel } from "../models.js";
import type { ClaudeModel } from "../models.js";
export type { ClaudeModel } from "../models.js";

/**
 * Extract text from message content which can be either a string
 * or an array of content parts (OpenAI format).
 */
function extractText(content: string | OpenAIContentPart[]): string {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .filter((part) => part.type === "text" && part.text)
      .map((part) => part.text!)
      .join("\n");
  }
  // Fallback: try to stringify
  return String(content);
}

export interface CliInput {
  prompt: string;
  model: ClaudeModel;
  systemPrompt?: string;
  sessionId?: string;
}

/**
 * Extract Claude model alias from request model string
 */
export function extractModel(model: string): ClaudeModel {
  const resolved = resolveModel(model);
  if (resolved) {
    return resolved.cliAlias;
  }

  throw Object.assign(new Error(`invalid_model: unsupported model "${model}"`), {
    code: "invalid_model",
  });
}

/**
 * Extract system messages from OpenAI messages array.
 * Returns the concatenated system prompt text, or undefined if none.
 */
export function extractSystemPrompt(messages: OpenAIChatRequest["messages"]): string | undefined {
  const systemParts: string[] = [];
  for (const msg of messages) {
    if (msg.role === "system" || msg.role === "developer") {
      systemParts.push(extractText(msg.content));
    }
  }
  return systemParts.length > 0 ? systemParts.join("\n") : undefined;
}

/**
 * Convert OpenAI messages array to a single prompt string for Claude CLI
 *
 * Claude Code CLI in --print mode expects a single prompt, not a conversation.
 * System messages are extracted separately (passed via --append-system-prompt).
 */
export function messagesToPrompt(messages: OpenAIChatRequest["messages"]): string {
  const parts: string[] = [];

  for (const msg of messages) {
    const text = extractText(msg.content);
    switch (msg.role) {
      case "system":
      case "developer":
        // System messages handled via --append-system-prompt, skip here
        break;

      case "user":
        // User messages are the main prompt
        parts.push(text);
        break;

      case "assistant":
        // Previous assistant responses for context
        parts.push(`<previous_response>\n${text}\n</previous_response>\n`);
        break;
    }
  }

  return parts.join("\n").trim();
}

/**
 * Convert OpenAI chat request to CLI input format
 */
export function openaiToCli(request: OpenAIChatRequest): CliInput {
  const resolved = resolveModel(request.model);

  if (!resolved) {
    throw Object.assign(new Error(`invalid_model: unsupported model "${request.model}"`), {
      code: "invalid_model",
    });
  }

  return {
    prompt: messagesToPrompt(request.messages),
    model: resolved.cliAlias,
    systemPrompt: extractSystemPrompt(request.messages),
    sessionId: request.user, // Use OpenAI's user field for session mapping
  };
}
