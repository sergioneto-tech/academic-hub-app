import { createClient } from "npm:@supabase/supabase-js@2.95.3";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export default {
  async fetch(req: Request) {
    if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRole) return json({ error: "Server configuration missing" }, 503);
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
    if (!token) return json({ error: "Unauthorized" }, 401);
    const db = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
    const { data: userData, error: userError } = await db.auth.getUser(token);
    if (userError || !userData.user?.id) return json({ error: "Unauthorized" }, 401);
    const { data, error } = await db.rpc("security_user_activity", { p_user_id: userData.user.id, p_limit: 20 });
    if (error) return json({ error: "Activity unavailable" }, 503);
    return json({ activity: data ?? [] });
  }
};
