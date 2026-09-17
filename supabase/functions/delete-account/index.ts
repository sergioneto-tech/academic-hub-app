import { createClient } from "npm:@supabase/supabase-js@2.95.3";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STORAGE_BUCKET = "feedback-attachments";
const STORAGE_PAGE_SIZE = 1000;
const STORAGE_REMOVE_BATCH_SIZE = 1000;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Cache-Control": "no-store" },
});

type StorageEntry = { name?: string | null };

async function listAllEntries(
  admin: ReturnType<typeof createClient>,
  path: string,
): Promise<StorageEntry[]> {
  const entries: StorageEntry[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await admin.storage
      .from(STORAGE_BUCKET)
      .list(path, { limit: STORAGE_PAGE_SIZE, offset, sortBy: { column: "name", order: "asc" } });

    if (error) throw error;

    const page = data ?? [];
    entries.push(...page);
    if (page.length < STORAGE_PAGE_SIZE) break;
    offset += page.length;
  }

  return entries;
}

async function removeInBatches(
  admin: ReturnType<typeof createClient>,
  paths: string[],
) {
  for (let index = 0; index < paths.length; index += STORAGE_REMOVE_BATCH_SIZE) {
    const batch = paths.slice(index, index + STORAGE_REMOVE_BATCH_SIZE);
    const { error } = await admin.storage.from(STORAGE_BUCKET).remove(batch);
    if (error) throw error;
  }
}

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

  try {
    const folders = await listAllEntries(admin, user.id);

    for (const folder of folders) {
      if (!folder.name) continue;
      const folderPath = `${user.id}/${folder.name}`;
      const files = await listAllEntries(admin, folderPath);
      const paths = files
        .map((file) => file.name ? `${folderPath}/${file.name}` : "")
        .filter(Boolean);
      await removeInBatches(admin, paths);
    }

    // Verify the user's Storage prefix is empty before deleting Auth. This keeps
    // account deletion fail-closed if a concurrent upload or pagination anomaly occurs.
    const remaining = await listAllEntries(admin, user.id);
    if (remaining.length > 0) {
      console.error("delete-account storage verification", `remaining=${remaining.length}`);
      return json({ error: "Account deletion failed" }, 503);
    }
  } catch (error) {
    console.error("delete-account storage cleanup", error instanceof Error ? error.message : String(error));
    return json({ error: "Account deletion failed" }, 503);
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error("delete-account", deleteError.message);
    return json({ error: "Account deletion failed" }, 503);
  }

  return json({ ok: true });
});
