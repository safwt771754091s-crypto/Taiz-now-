/**
 * Shared LLM layer. Groq and OpenAI both speak the OpenAI chat-completions API,
 * so one client factory serves both. Groq is preferred when configured because
 * its free tier needs no card; without either key the platform stays offline.
 */

export type LlmProvider = "groq" | "openai";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

export function activeProvider(): LlmProvider | null {
  if (process.env.GROQ_API_KEY) return "groq";
  if (process.env.OPENAI_API_KEY) return "openai";
  return null;
}

export const AI_ENABLED = activeProvider() !== null;

export function activeModel(): string {
  if (activeProvider() === "groq") return process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  return process.env.OPENAI_MODEL || "gpt-4o-mini";
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
