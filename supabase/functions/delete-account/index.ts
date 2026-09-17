import { createClient } from "npm:@supabase/supabase-js@2.95.3";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Cache-Control": "no-store" },
});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  if (!jwt) return json({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Configuration unavailable" }, 503);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(jwt);
  const user = userData?.user;
  if (userError || !user?.id) return json({ error: "Unauthorized" }, 401);

  const { data: folders, error: listRootError } = await admin.storage
    .from("feedback-attachments")
    .list(user.id, { limit: 1000 });
  if (listRootError) {
    console.error("delete-account storage list", listRootError.message);
    return json({ error: "Account deletion failed" }, 503);
  }

  for (const folder of folders ?? []) {
    if (!folder.name) continue;
    const { data: files, error: listFilesError } = await admin.storage
      .from("feedback-attachments")
      .list(`${user.id}/${folder.name}`, { limit: 1000 });
    if (listFilesError) {
      console.error("delete-account storage folder", listFilesError.message);
      return json({ error: "Account deletion failed" }, 503);
    }

    const paths = (files ?? [])
      .map((file) => file.name ? `${user.id}/${folder.name}/${file.name}` : "")
      .filter(Boolean);
    if (paths.length) {
      const { error: removeError } = await admin.storage.from("feedback-attachments").remove(paths);
      if (removeError) {
        console.error("delete-account storage remove", removeError.message);
        return json({ error: "Account deletion failed" }, 503);
      }
    }
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error("delete-account", deleteError.message);
    return json({ error: "Account deletion failed" }, 503);
  }

  return json({ ok: true });
});
