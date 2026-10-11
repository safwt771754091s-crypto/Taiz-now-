import { afterEach, describe, expect, it } from "vitest";
import { activeProvider, activeModel, aiProviderLabel } from "@/lib/llm";

const saved = { groq: process.env.GROQ_API_KEY, openai: process.env.OPENAI_API_KEY };

afterEach(() => {
  if (saved.groq === undefined) delete process.env.GROQ_API_KEY;
  else process.env.GROQ_API_KEY = saved.groq;
  if (saved.openai === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = saved.openai;
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

  it("returns null and an offline label when neither key is set", () => {
    delete process.env.GROQ_API_KEY;
    delete process.env.OPENAI_API_KEY;
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
