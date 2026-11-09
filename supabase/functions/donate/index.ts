// Supabase Edge Function "donate": saves one donation section, but only after
// Cloudflare Turnstile confirms the request came from a person in a real browser.
//
// Deploy: Supabase dashboard > Edge Functions > Create function named "donate",
// paste this whole file, and turn OFF "Verify JWT" (Turnstile replaces it).
// Secrets: set TURNSTILE_SECRET_KEY under Edge Functions > Secrets.
//
// The website's role can't insert into the table directly once
// supabase/005_require_bot_check.sql has been run, so this is the only way in.

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const MODULES = new Set(["core", "southAsian", "context"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 16_384;

export interface Env {
  turnstileSecret: string;
  supabaseUrl: string;
  /** Server-only key that may insert into the donations table. */
  serviceKey: string;
  /** Sites allowed to call this function from a browser. */
  allowedOrigins: string[];
}

function cors(origin: string | null, env: Env): Record<string, string> {
  const allowed = origin && env.allowedOrigins.includes(origin) ? origin : env.allowedOrigins[0] ?? "";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-client-info",
    Vary: "Origin",
  };
}

export async function handle(
  request: Request,
  env: Env,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  const headers = cors(request.headers.get("Origin"), env);
  const reply = (status: number, body?: object) =>
    new Response(body ? JSON.stringify(body) : null, {
      status,
      headers: { ...headers, "Content-Type": "application/json" },
    });

  if (request.method === "OPTIONS") return reply(204);
  if (request.method !== "POST") return reply(405, { error: "method-not-allowed" });

  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return reply(413, { error: "too-large" });

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text);
  } catch {
    return reply(400, { error: "invalid-json" });
  }
  const { token, donation_id, module, answers, app_version } = body ?? {};
  if (typeof token !== "string" || !token) return reply(400, { error: "missing-bot-check" });
  if (typeof donation_id !== "string" || !UUID.test(donation_id)) return reply(400, { error: "invalid-id" });
  if (typeof module !== "string" || !MODULES.has(module)) return reply(400, { error: "invalid-module" });
  if (typeof answers !== "object" || answers === null || Array.isArray(answers)) {
    return reply(400, { error: "invalid-answers" });
  }
  if (typeof app_version !== "string" || app_version.length > 40) {
    return reply(400, { error: "invalid-version" });
  }

  // The visitor's IP is deliberately not sent to Cloudflare from here.
  const verification = await fetchImpl(SITEVERIFY, {
    method: "POST",
    body: new URLSearchParams({ secret: env.turnstileSecret, response: token }),
  });
  const result = (await verification.json()) as { success?: boolean };
  if (!result.success) return reply(403, { error: "bot-check-failed" });

  const insert = await fetchImpl(`${env.supabaseUrl}/rest/v1/donations`, {
    method: "POST",
    headers: {
      apikey: env.serviceKey,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ donation_id, module, answers, app_version }),
  });
  if (insert.status === 201) return reply(201, { saved: true });
  // Already saved (say, a double click) counts as success.
  if (insert.status === 409) return reply(200, { saved: true });
  return reply(502, { error: "save-failed" });
}

// Supabase runs this file on Deno; the tests import `handle` without starting a server.
declare const Deno:
  | { env: { get(name: string): string | undefined }; serve(h: (r: Request) => Promise<Response>): void }
  | undefined;

if (typeof Deno !== "undefined") {
  const get = (name: string) => Deno!.env.get(name) ?? "";
  const secretKeys = get("SUPABASE_SECRET_KEYS");
  const env: Env = {
    turnstileSecret: get("TURNSTILE_SECRET_KEY"),
    supabaseUrl: get("SUPABASE_URL"),
    serviceKey: secretKeys ? JSON.parse(secretKeys).default : get("SUPABASE_SERVICE_ROLE_KEY"),
    allowedOrigins: [
      "https://anika-lakhani.github.io",
      "http://localhost:5173",
      "http://localhost:4173",
    ],
  };
  Deno.serve((request) => handle(request, env));
}
