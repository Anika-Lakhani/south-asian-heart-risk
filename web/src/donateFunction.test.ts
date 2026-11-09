import { describe, expect, it, vi } from "vitest";

import { handle, type Env } from "../../supabase/functions/donate/index";

const env: Env = {
  turnstileSecret: "test-secret",
  supabaseUrl: "https://example.supabase.co",
  serviceKey: "sb_secret_test",
  allowedOrigins: ["https://anika-lakhani.github.io", "http://localhost:5173"],
};

const valid = {
  token: "XXXX.DUMMY.TOKEN.XXXX",
  donation_id: "6f1c1f3e-1111-4a4a-9999-123456789abc",
  module: "core",
  answers: { intake: { ageBand: "45-49" } },
  app_version: "abc123",
};

/** Fake Cloudflare and Supabase responses, recording what was sent. */
function fakeFetch({ human = true, insertStatus = 201 } = {}) {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url).includes("siteverify")) {
      return new Response(JSON.stringify({ success: human }));
    }
    return new Response(null, { status: insertStatus, headers: init?.headers as HeadersInit });
  });
}

const post = (body: unknown, origin = "https://anika-lakhani.github.io") =>
  new Request("https://example.supabase.co/functions/v1/donate", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

describe("donate function", () => {
  it("saves a section once the bot check passes", async () => {
    const fetchImpl = fakeFetch();
    const response = await handle(post(valid), env, fetchImpl);
    expect(response.status).toBe(201);
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    const [verifyUrl, verifyInit] = fetchImpl.mock.calls[0]!;
    expect(String(verifyUrl)).toContain("siteverify");
    const verifyBody = new URLSearchParams(String(verifyInit?.body));
    expect(verifyBody.get("secret")).toBe("test-secret");
    expect(verifyBody.get("response")).toBe(valid.token);
    expect(verifyBody.has("remoteip")).toBe(false); // the visitor's IP isn't forwarded

    const [insertUrl, insertInit] = fetchImpl.mock.calls[1]!;
    expect(String(insertUrl)).toBe("https://example.supabase.co/rest/v1/donations");
    const saved = JSON.parse(String(insertInit?.body));
    expect(saved).toEqual({
      donation_id: valid.donation_id,
      module: "core",
      answers: valid.answers,
      app_version: "abc123",
    });
    expect(saved).not.toHaveProperty("token"); // the token is never stored
  });

  it("refuses to save when the bot check fails", async () => {
    const fetchImpl = fakeFetch({ human: false });
    const response = await handle(post(valid), env, fetchImpl);
    expect(response.status).toBe(403);
    expect(fetchImpl).toHaveBeenCalledTimes(1); // nothing reaches the database
  });

  it.each([
    ["no bot-check token", { ...valid, token: "" }],
    ["a malformed ID", { ...valid, donation_id: "not-a-uuid" }],
    ["an unknown section", { ...valid, module: "hack" }],
    ["answers that aren't an object", { ...valid, answers: [1, 2] }],
    ["an overlong version", { ...valid, app_version: "x".repeat(41) }],
  ])("rejects %s without contacting Cloudflare", async (_, body) => {
    const fetchImpl = fakeFetch();
    const response = await handle(post(body), env, fetchImpl);
    expect(response.status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects invalid JSON and oversized bodies", async () => {
    expect((await handle(post("{nope"), env, fakeFetch())).status).toBe(400);
    const huge = { ...valid, answers: { x: "a".repeat(20_000) } };
    expect((await handle(post(huge), env, fakeFetch())).status).toBe(413);
  });

  it("treats an already-saved section as success", async () => {
    const response = await handle(post(valid), env, fakeFetch({ insertStatus: 409 }));
    expect(response.status).toBe(200);
  });

  it("reports a database failure without claiming success", async () => {
    const response = await handle(post(valid), env, fakeFetch({ insertStatus: 500 }));
    expect(response.status).toBe(502);
  });

  it("only allows browsers on the app's own sites", async () => {
    const own = await handle(post(valid, "http://localhost:5173"), env, fakeFetch());
    expect(own.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
    const other = await handle(post(valid, "https://evil.example"), env, fakeFetch());
    expect(other.headers.get("Access-Control-Allow-Origin")).toBe("https://anika-lakhani.github.io");
  });

  it("answers the browser's preflight and refuses other methods", async () => {
    const preflight = new Request("https://example.supabase.co/functions/v1/donate", {
      method: "OPTIONS",
      headers: { Origin: "https://anika-lakhani.github.io" },
    });
    expect((await handle(preflight, env, fakeFetch())).status).toBe(204);
    const get = new Request("https://example.supabase.co/functions/v1/donate");
    expect((await handle(get, env, fakeFetch())).status).toBe(405);
  });
});
