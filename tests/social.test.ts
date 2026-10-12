import { afterEach, describe, expect, it, vi } from "vitest";
import { deliver } from "@/lib/social/publisher";

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.X_ACCESS_TOKEN;
  delete process.env.X_BEARER_TOKEN;
  delete process.env.X_API_KEY;
});

describe("x adapter", () => {
  it("stays in mock mode when no X credentials are configured", async () => {
    const res = await deliver({ provider: "x", handle: "@taiznow", body: "مرحبا" });
    expect(res.mode).toBe("mock");
  });

  it("posts to api.x.com and truncates the text to 280 characters", async () => {
    process.env.X_API_KEY = "test-key";
    process.env.X_ACCESS_TOKEN = "test-token";
    const calls: { url: string; init: { body?: string } }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: { body?: string }) => {
        calls.push({ url, init });
        return new Response(JSON.stringify({ data: { id: "tweet-1" } }), { status: 201 });
      }),
    );

    const res = await deliver({ provider: "x", handle: "@taiznow", body: "أ".repeat(400) });

    expect(res.ok).toBe(true);
    expect(res.mode).toBe("live");
    expect(res.externalId).toBe("tweet-1");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("api.x.com/2/tweets");
    const sent = JSON.parse(calls[0].init.body ?? "{}") as { text: string };
    expect(sent.text.length).toBeLessThanOrEqual(280);
    expect(sent.text.endsWith("…")).toBe(true);
  });

  it("surfaces the provider error message on failure", async () => {
    process.env.X_API_KEY = "test-key";
    process.env.X_ACCESS_TOKEN = "test-token";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ title: "Unauthorized" }), { status: 401 })),
    );

    const res = await deliver({ provider: "x", body: "مرحبا" });
    expect(res.ok).toBe(false);
    expect(res.detail).toContain("Unauthorized");
  });
});
