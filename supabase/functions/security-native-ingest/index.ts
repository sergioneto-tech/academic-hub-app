import { createClient } from "npm:@supabase/supabase-js@2.95.3";

const PROJECT_REF = "apgoyzfzuukkpmuxiqvy";
const ALLOWED_KINDS = new Set(["auth_failure", "auth_rate_limited", "unauthorized_api", "api_rate_limited"]);
const SIGNAL_PATTERN = /^[a-f0-9]{64}$/i;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

function bearerToken(req: Request) {
  const auth = req.headers.get("authorization") || "";
  return auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
}

async function validateLogsReadToken(token: string) {
  const end = new Date();
  const start = new Date(end.getTime() - 60_000);
  const params = new URLSearchParams({
    sql: "select count() as hits from logs where 1=0",
    iso_timestamp_start: start.toISOString().replace(/\.\d{3}Z$/, "Z"),
    iso_timestamp_end: end.toISOString().replace(/\.\d{3}Z$/, "Z"),
  });
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/analytics/endpoints/logs?${params.toString()}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return response.ok;
}

export default {
  async fetch(req: Request) {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const token = bearerToken(req);
    if (!token || !(await validateLogsReadToken(token))) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRole) return json({ error: "Server configuration unavailable" }, 503);

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid body" }, 400);
    }

    const signalKey = typeof body.signalKey === "string" ? body.signalKey.trim() : "";
    const kind = typeof body.kind === "string" ? body.kind.trim() : "";
    const ipAddress = typeof body.ipAddress === "string" ? body.ipAddress.trim().slice(0, 64) : null;
    const countryCode = typeof body.countryCode === "string" ? body.countryCode.trim().slice(0, 2) : null;
    const path = typeof body.path === "string" ? body.path.trim().slice(0, 256) : null;
    const status = Number(body.status);
    const hits = Number(body.hits);
    const firstSeen = typeof body.firstSeen === "string" ? body.firstSeen : "";
    const lastSeen = typeof body.lastSeen === "string" ? body.lastSeen : "";
    const clientInfo = typeof body.clientInfo === "string" ? body.clientInfo.trim().slice(0, 128) : null;

    if (!SIGNAL_PATTERN.test(signalKey) || !ALLOWED_KINDS.has(kind)) return json({ error: "Invalid signal" }, 400);
    if (!Number.isInteger(status) || status < 0 || status > 599) return json({ error: "Invalid status" }, 400);
    if (!Number.isInteger(hits) || hits < 1 || hits > 100000) return json({ error: "Invalid hits" }, 400);
    if (!firstSeen || !lastSeen || Number.isNaN(Date.parse(firstSeen)) || Number.isNaN(Date.parse(lastSeen))) {
      return json({ error: "Invalid time range" }, 400);
    }

    const db = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
    const { data, error } = await db.rpc("security_ingest_native_signal", {
      p_signal_key: signalKey,
      p_kind: kind,
      p_ip_address: ipAddress || null,
      p_country_code: countryCode || null,
      p_path: path || null,
      p_status: status,
      p_hits: hits,
      p_first_seen: firstSeen,
      p_last_seen: lastSeen,
      p_client_info: clientInfo || null,
    });

    if (error) {
      console.error("security-native-ingest", error.code, error.message);
      return json({ error: "Signal ingest unavailable" }, 503);
    }

    const row = Array.isArray(data) ? data[0] ?? null : data ?? null;
    return json({ ok: true, result: row });
  },
};
