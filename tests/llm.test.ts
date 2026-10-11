import { afterEach, describe, expect, it } from "vitest";
import { activeProvider, activeModel, aiProviderLabel } from "@/lib/llm";

const saved = {
  groq: process.env.GROQ_API_KEY,
  openai: process.env.OPENAI_API_KEY,
  ollamaEnabled: process.env.OLLAMA_ENABLED,
  ollamaUrl: process.env.OLLAMA_BASE_URL,
};

afterEach(() => {
  const restore = (key: string, value: string | undefined) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  };
  restore("GROQ_API_KEY", saved.groq);
  restore("OPENAI_API_KEY", saved.openai);
  restore("OLLAMA_ENABLED", saved.ollamaEnabled);
  restore("OLLAMA_BASE_URL", saved.ollamaUrl);
});

describe("LLM provider selection", () => {
  it("prefers Groq when its key is present", () => {
    process.env.GROQ_API_KEY = "gsk_test";
    process.env.OPENAI_API_KEY = "sk_test";
    expect(activeProvider()).toBe("groq");
    expect(aiProviderLabel()).toMatch(/^groq:/);
  });

  it("falls back to OpenAI when only its key is present", () => {
    delete process.env.GROQ_API_KEY;
    process.env.OPENAI_API_KEY = "sk_test";
    expect(activeProvider()).toBe("openai");
    expect(activeModel()).toBe(process.env.OPENAI_MODEL || "gpt-4o-mini");
  });

  it("uses local Ollama when explicitly enabled and no API keys exist", () => {
    delete process.env.GROQ_API_KEY;
    delete process.env.OPENAI_API_KEY;
    process.env.OLLAMA_ENABLED = "true";
    expect(activeProvider()).toBe("ollama");
    expect(aiProviderLabel()).toMatch(/^ollama:/);
  });

  it("treats a configured OLLAMA_BASE_URL as opting in", () => {
    delete process.env.GROQ_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OLLAMA_ENABLED;
    process.env.OLLAMA_BASE_URL = "http://127.0.0.1:11434/v1";
    expect(activeProvider()).toBe("ollama");
  });

  it("returns null and an offline label when nothing is configured", () => {
    delete process.env.GROQ_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OLLAMA_ENABLED;
    delete process.env.OLLAMA_BASE_URL;
    expect(activeProvider()).toBeNull();
    expect(aiProviderLabel()).toBe("offline-heuristics");
  });

  it("uses the Groq model env override", () => {
    process.env.GROQ_API_KEY = "gsk_test";
    process.env.GROQ_MODEL = "llama-3.1-8b-instant";
    expect(activeModel()).toBe("llama-3.1-8b-instant");
    delete process.env.GROQ_MODEL;
  });
});
