import { getStoredSession } from "@/lib/cloudSync";
import { getPublicSupabaseConfig } from "@/lib/publicSupabaseConfig";

export const TRANSPARENCY_DOCUMENT_VERSION = "1.0";
export const TRANSPARENCY_DOCUMENT_APPLIES_TO = "1.6.6";

export async function openTransparencyDocument(): Promise<void> {
  const config = getPublicSupabaseConfig();
  const session = config ? getStoredSession(config) : null;

  if (!config || !session?.access_token) {
    throw new Error("É necessário iniciar sessão para consultar o documento completo.");
  }

  const viewer = window.open("", "_blank", "noopener,noreferrer");
  const endpoint = `${config.supabaseUrl.replace(/\/$/, "")}/functions/v1/transparency-document`;

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${session.access_token}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(response.status === 401
        ? "A sessão expirou. Volta a entrar na conta e tenta novamente."
        : "Não foi possível abrir o documento neste momento.");
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    if (viewer) {
      viewer.location.replace(objectUrl);
    } else {
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.click();
    }

    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 120_000);
  } catch (error) {
    viewer?.close();
    throw error;
  }
}
