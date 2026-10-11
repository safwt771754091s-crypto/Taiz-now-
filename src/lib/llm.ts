/**
 * Shared LLM layer. Groq and OpenAI both speak the OpenAI chat-completions API,
 * so one client factory serves both. Free engines come first: Groq (free tier,
 * no card) then a local Ollama server (offline, no account); OpenAI is the last
 * resort. Without any of these the platform stays deterministic and offline.
 */

export type LlmProvider = "groq" | "openai" | "ollama";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434/v1";

export function activeProvider(): LlmProvider | null {
  if (process.env.GROQ_API_KEY) return "groq";
  if (process.env.OLLAMA_ENABLED === "true") return "ollama";
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.OLLAMA_BASE_URL) return "ollama";
  return null;
}

export const AI_ENABLED = activeProvider() !== null;

export function activeModel(): string {
  switch (activeProvider()) {
    case "groq":
      return process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
    case "ollama":
      return process.env.OLLAMA_MODEL || "llama3.2:3b";
    default:
      return process.env.OPENAI_MODEL || "gpt-4o-mini";
  }
}

/** Human-readable model id stored on AI output, e.g. "groq:llama-3.3-70b-versatile". */
export function aiProviderLabel(): string {
  const provider = activeProvider();
  return provider ? `${provider}:${activeModel()}` : "offline-heuristics";
}

/**
 * Ask the configured model for a JSON object. Throws when no provider is
 * configured or the request fails, so callers decide how to fall back.
 */
export async function chatJson(
  system: string,
  user: string,
  temperature = 0.3,
): Promise<Record<string, unknown>> {
  const provider = activeProvider();
  if (!provider) throw new Error("لا يوجد مزوّد ذكاء اصطناعي مهيأ");

  const { default: OpenAI } = await import("openai");
  const client =
    provider === "groq"
      ? new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: GROQ_BASE_URL })
      : provider === "ollama"
        ? new OpenAI({ apiKey: "ollama", baseURL: OLLAMA_BASE_URL })
        : new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const completion = await client.chat.completions.create({
    model: activeModel(),
    temperature,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  return JSON.parse(completion.choices[0]?.message?.content ?? "{}") as Record<string, unknown>;
}
