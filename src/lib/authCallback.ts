export type ImplicitAuthCallback = {
  kind: "recovery" | "account-confirmation";
  accessToken: string;
  refreshToken: string;
};

/**
 * Supabase's client-side implicit auth flow returns session tokens in the URL
 * fragment. The Academic Hub uses HashRouter too, so auth fragments must be
 * consumed before React Router interprets them as an application route.
 */
export function parseImplicitAuthCallback(rawHash: string): ImplicitAuthCallback | null {
  const normalized = rawHash.startsWith("#") ? rawHash.slice(1) : rawHash;
  if (!normalized || !normalized.includes("access_token")) return null;

  const params = new URLSearchParams(normalized);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) return null;

  const type = (params.get("type") ?? "").trim().toLowerCase();
  if (type === "recovery") {
    return { kind: "recovery", accessToken, refreshToken };
  }

  // Supabase confirmation redirects can identify the flow as `signup` or
  // `email` depending on the email template / verification endpoint used.
  if (type === "signup" || type === "email") {
    return { kind: "account-confirmation", accessToken, refreshToken };
  }

  return null;
}
