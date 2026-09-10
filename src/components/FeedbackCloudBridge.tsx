import { useEffect, useRef } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getStoredSession, refreshSession, type AuthSession, type CloudConfig } from "@/lib/cloudSync";
import {
  FEEDBACK_BETA_EVENT,
  currentFeedbackUserId,
  isFeedbackBetaManager,
  loadFeedbackStore,
  saveFeedbackStore,
  type FeedbackAttachment,
  type FeedbackEntry,
  type FeedbackHistoryItem,
  type FeedbackKind,
  type FeedbackMessage,
  type FeedbackStatus,
} from "@/lib/feedbackBeta";

type FeedbackRequestRow = {
  id: string;
  reference: string;
  user_id: string;
  kind: FeedbackKind;
  area: string | null;
  title: string;
  body: string;
  steps: string | null;
  expected: string | null;
  status: FeedbackStatus;
  resolution_note: string | null;
  resolved_version: string | null;
  app_version: string;
  device: string;
  manager_read_at: string | null;
  created_at: string;
  updated_at: string;
};

type FeedbackMessageRow = {
  id: string;
  request_id: string;
  author: "student" | "academic_hub";
  body: string;
  created_at: string;
  read_at: string | null;
};

type FeedbackHistoryRow = {
  id: string;
  request_id: string;
  status: FeedbackStatus;
  note: string | null;
  created_at: string;
};

type FeedbackAttachmentRow = {
  id: string;
  request_id: string;
  storage_path: string;
  name: string;
  mime_type: string | null;
  size_bytes: number;
  created_at: string;
};

type FeedbackDatabase = {
  public: {
    Tables: {
      feedback_requests: {
        Row: FeedbackRequestRow;
        Insert: Partial<FeedbackRequestRow> & Pick<FeedbackRequestRow, "user_id" | "kind" | "title" | "app_version" | "device">;
        Update: Partial<FeedbackRequestRow>;
        Relationships: [];
      };
      feedback_messages: {
        Row: FeedbackMessageRow;
        Insert: Partial<FeedbackMessageRow> & Pick<FeedbackMessageRow, "request_id" | "author" | "body">;
        Update: Partial<FeedbackMessageRow>;
        Relationships: [];
      };
      feedback_history: {
        Row: FeedbackHistoryRow;
        Insert: Partial<FeedbackHistoryRow> & Pick<FeedbackHistoryRow, "request_id" | "status">;
        Update: Partial<FeedbackHistoryRow>;
        Relationships: [];
      };
      feedback_attachments: {
        Row: FeedbackAttachmentRow;
        Insert: Partial<FeedbackAttachmentRow> & Pick<FeedbackAttachmentRow, "request_id" | "storage_path" | "name">;
        Update: Partial<FeedbackAttachmentRow>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      feedback_kind: FeedbackKind;
      feedback_status: FeedbackStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
};

const db = supabase as unknown as SupabaseClient<FeedbackDatabase>;
const SYNCING = new Set<string>();
const ACTIVE_FEEDBACK_POLL_MS = 2 * 60_000;

function cloudConfig(): CloudConfig | null {
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "").trim();
  const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();
  return supabaseUrl && supabaseAnonKey ? { supabaseUrl, supabaseAnonKey } : null;
}

async function ensureFeedbackSession(): Promise<AuthSession | null> {
  const config = cloudConfig();
  if (!config) return null;

  const stored = getStoredSession(config);
  if (!stored) return null;

  let session = stored;
  const expiresAt = Number(stored.expires_at ?? 0) * 1000;
  if (expiresAt && expiresAt <= Date.now() + 60_000) {
    try {
      session = await refreshSession(config, stored);
    } catch {
      return null;
    }
  }

  const { error } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (error) return null;
  return session;
}

function notifyCloudRefresh() {
  window.dispatchEvent(new CustomEvent(FEEDBACK_BETA_EVENT, { detail: { source: "cloud" } }));
}

function rowToEntry(row: FeedbackRequestRow, messages: FeedbackMessage[], history: FeedbackHistoryItem[], attachments: FeedbackAttachment[]): FeedbackEntry {
  return {
    id: row.id,
    reference: row.reference,
    userId: row.user_id,
    kind: row.kind,
    area: row.area ?? undefined,
    title: row.title,
    body: row.body ?? "",
    steps: row.steps ?? undefined,
    expected: row.expected ?? undefined,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    readAt: row.manager_read_at ?? undefined,
    resolutionNote: row.resolution_note ?? undefined,
    resolvedVersion: row.resolved_version ?? undefined,
    appVersion: row.app_version,
    device: row.device,
    attachments,
    messages,
    history,
  };
}

async function pullFromCloud() {
  if (document.visibilityState !== "visible" || !navigator.onLine) return;
  const session = await ensureFeedbackSession();
  const userId = session?.user.id ?? currentFeedbackUserId();
  if (!session || !userId || userId === "feedback-beta-preview") return;

  const { data: requests, error } = await db.from("feedback_requests").select("*").order("created_at", { ascending: false });
  if (error || !requests) return;
  const ids = requests.map((row) => row.id);
  if (!ids.length) {
    saveFeedbackStore({ entries: [], counter: 0 }, false);
    notifyCloudRefresh();
    return;
  }

  const [{ data: messageRows }, { data: historyRows }, { data: attachmentRows }] = await Promise.all([
    db.from("feedback_messages").select("*").in("request_id", ids).order("created_at", { ascending: true }),
    db.from("feedback_history").select("*").in("request_id", ids).order("created_at", { ascending: true }),
    db.from("feedback_attachments").select("*").in("request_id", ids).order("created_at", { ascending: true }),
  ]);

  const entries = requests.map((row) => rowToEntry(
    row,
    (messageRows ?? []).filter((message) => message.request_id === row.id).map((message) => ({
      id: message.id,
      author: message.author,
      body: message.body,
      createdAt: message.created_at,
      readAt: message.read_at ?? undefined,
    })),
    (historyRows ?? []).filter((item) => item.request_id === row.id).map((item) => ({ id: item.id, status: item.status, note: item.note ?? undefined, createdAt: item.created_at })),
    (attachmentRows ?? []).filter((attachment) => attachment.request_id === row.id).map((attachment) => ({ id: attachment.id, name: attachment.name, type: attachment.mime_type ?? "", size: Number(attachment.size_bytes) || 0 })),
  ));

  const counter = entries.reduce((max: number, entry: FeedbackEntry) => {
    const parsed = Number(entry.reference.replace(/^AH-/, ""));
    return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
  }, 0);
  saveFeedbackStore({ entries, counter }, false);
  notifyCloudRefresh();
}

async function uploadFiles(userId: string, requestId: string, files: File[]) {
  for (const file of files.slice(0, 3)) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120) || "captura.png";
    const path = `${userId}/${requestId}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await db.storage.from("feedback-attachments").upload(path, file, { upsert: false, contentType: file.type || undefined });
    if (uploadError) continue;
    await db.from("feedback_attachments").insert({
      request_id: requestId,
      storage_path: path,
      name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
    });
  }
}

async function pushLocalChanges(pendingFiles: File[]) {
  const session = await ensureFeedbackSession();
  const userId = session?.user.id ?? currentFeedbackUserId();
  if (!session || !userId || userId === "feedback-beta-preview") return;
  const manager = isFeedbackBetaManager();
  const localEntries = loadFeedbackStore().entries;

  const { data: remoteRows, error: remoteError } = await db.from("feedback_requests").select("id,reference,status,resolution_note,resolved_version,manager_read_at,user_id");
  if (remoteError) return;
  const remoteById = new Map((remoteRows ?? []).map((row) => [row.id, row]));

  for (const entry of localEntries) {
    if (SYNCING.has(entry.id)) continue;
    SYNCING.add(entry.id);
    try {
      const remote = remoteById.get(entry.id);
      if (!remote) {
        if (entry.userId !== userId) continue;
        const { data: inserted, error } = await db.from("feedback_requests").insert({
          id: entry.id,
          user_id: entry.userId,
          kind: entry.kind,
          area: entry.area ?? null,
          title: entry.title,
          body: entry.body,
          steps: entry.steps ?? null,
          expected: entry.expected ?? null,
          app_version: entry.appVersion,
          device: entry.device,
        }).select("id,reference").single();
        if (!error && inserted && pendingFiles.length) {
          await uploadFiles(userId, entry.id, pendingFiles.splice(0, pendingFiles.length));
        }
      } else if (manager) {
        const patch: Partial<FeedbackRequestRow> = {};
        if (remote.status !== entry.status) patch.status = entry.status;
        if ((remote.resolution_note ?? undefined) !== entry.resolutionNote) patch.resolution_note = entry.resolutionNote ?? null;
        if ((remote.resolved_version ?? undefined) !== entry.resolvedVersion) patch.resolved_version = entry.resolvedVersion ?? null;
        if (!remote.manager_read_at && entry.readAt) patch.manager_read_at = entry.readAt;
        if (Object.keys(patch).length) await db.from("feedback_requests").update(patch).eq("id", entry.id);
      }

      const { data: remoteMessages } = await db.from("feedback_messages").select("id").eq("request_id", entry.id);
      const remoteMessageIds = new Set((remoteMessages ?? []).map((message) => message.id));
      for (const message of entry.messages) {
        if (remoteMessageIds.has(message.id)) continue;
        if (message.author === "academic_hub" && !manager) continue;
        await db.from("feedback_messages").insert({ id: message.id, request_id: entry.id, author: message.author, body: message.body, created_at: message.createdAt });
      }
    } finally {
      SYNCING.delete(entry.id);
    }
  }

  await pullFromCloud();
}

export default function FeedbackCloudBridge() {
  const pendingFiles = useRef<File[]>([]);
  const busy = useRef(false);

  useEffect(() => {
    const captureFiles = (event: Event) => {
      const input = event.target as HTMLInputElement | null;
      if (!input || input.type !== "file" || !window.location.hash.includes("/feedback")) return;
      pendingFiles.current = Array.from(input.files ?? []).slice(0, 3);
    };
    const sync = async (event: Event) => {
      if (event instanceof CustomEvent && event.detail?.source === "cloud") return;
      if (busy.current || document.visibilityState !== "visible") return;
      busy.current = true;
      try { await pushLocalChanges(pendingFiles.current); } finally { busy.current = false; }
    };
    const pull = () => { void pullFromCloud(); };
    const onVisible = () => {
      if (document.visibilityState === "visible") pull();
    };
    const onAuthChanged = () => { void pullFromCloud(); };

    document.addEventListener("change", captureFiles, true);
    window.addEventListener(FEEDBACK_BETA_EVENT, sync);
    window.addEventListener("academic-hub-auth-changed", onAuthChanged);
    window.addEventListener("online", pull);
    document.addEventListener("visibilitychange", onVisible);
    void pullFromCloud();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible" && window.location.hash.includes("/feedback")) pull();
    }, ACTIVE_FEEDBACK_POLL_MS);

    return () => {
      document.removeEventListener("change", captureFiles, true);
      window.removeEventListener(FEEDBACK_BETA_EVENT, sync);
      window.removeEventListener("academic-hub-auth-changed", onAuthChanged);
      window.removeEventListener("online", pull);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
