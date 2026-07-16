import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { handleModels, handleChatCompletions } from "./routes.js";
import { ClaudeSubprocess } from "../subprocess/manager.js";

function createResponse() {
  const response: any = {
    statusCode: 200,
    payload: undefined,
    headers: new Map<string, string>(),
    headersSent: false,
    writableEnded: false,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.payload = body;
      this.headersSent = true;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers.set(name, value);
      return this;
    },
    flushHeaders() {
      this.headersSent = true;
    },
    write() {
      return true;
    },
    end() {
      this.writableEnded = true;
      return this;
    },
    on() {
      return this;
    },
  };
  return response;
}

describe("route handlers", () => {
  it("returns the advertised model list", () => {
    const res = createResponse();
    handleModels({} as never, res);

    assert.deepEqual(res.payload, {
      object: "list",
      data: [
        { id: "claude-fable-5", object: "model", owned_by: "anthropic" },
        { id: "claude-opus-4-8", object: "model", owned_by: "anthropic" },
        { id: "claude-sonnet-5", object: "model", owned_by: "anthropic" },
        { id: "claude-haiku-4-5-20251001", object: "model", owned_by: "anthropic" },
      ],
    });
  });

  it("rejects invalid models before subprocess spawn", async () => {
    const originalStart = ClaudeSubprocess.prototype.start;
    let startCalled = false;
    ClaudeSubprocess.prototype.start = (async () => {
      startCalled = true;
      throw new Error("should not run");
    }) as typeof ClaudeSubprocess.prototype.start;

    try {
      const res = createResponse();
      await handleChatCompletions(
        {
          body: {
            model: "gpt-4o",
            messages: [{ role: "user", content: "Hello" }],
          },
        } as never,
        res
      );

      assert.equal(res.statusCode, 400);
      assert.equal(res.payload?.error?.code, "invalid_model");
      assert.equal(startCalled, false);
    } finally {
      ClaudeSubprocess.prototype.start = originalStart;
    }
  });

  it("forwards accepted aliases to the CLI alias without changing the response model", async () => {
    const originalStart = ClaudeSubprocess.prototype.start;
    let capturedModel = "";
    let capturedPrompt = "";

    ClaudeSubprocess.prototype.start = (async function (this: ClaudeSubprocess, prompt: string, options: { model: string }) {
      capturedPrompt = prompt;
      capturedModel = options.model;
      this.emit("result", {
        type: "result",
        subtype: "success",
        is_error: false,
        duration_ms: 1,
        duration_api_ms: 1,
        num_turns: 1,
        result: "ok",
        session_id: "sess",
        total_cost_usd: 0,
        usage: { input_tokens: 1, output_tokens: 1 },
        modelUsage: {},
      });
      this.emit("close", 0);
    }) as typeof ClaudeSubprocess.prototype.start;

    try {
      const res = createResponse();
      await handleChatCompletions(
        {
          body: {
            model: "claude-openai/claude-opus-4-6",
            messages: [{ role: "user", content: "Hello" }],
          },
        } as never,
        res
      );

      assert.equal(capturedModel, "opus");
      assert.equal(capturedPrompt, "Hello");
      assert.equal(res.payload.model, "claude-openai/claude-opus-4-6");
    } finally {
      ClaudeSubprocess.prototype.start = originalStart;
    }
  });
});
