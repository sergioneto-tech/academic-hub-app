export type ThemeMode = "light" | "dark" | "system";

const THEME_KEY = "academic_hub_theme";

export function getStoredTheme(): ThemeMode | null {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === "dark" || value === "light" || value === "system" ? value : null;
  } catch {
    return null;
  }
}

export function storeTheme(theme: ThemeMode) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // A aplicação continua funcional mesmo sem acesso ao localStorage.
  }
}

export function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  try {
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function resolveTheme(theme: ThemeMode): "light" | "dark" {
  return theme === "system" ? getSystemTheme() : theme;
}

export function applyTheme(theme: ThemeMode) {
  if (typeof document === "undefined") return;
  const resolved = resolveTheme(theme);
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = resolved;
}

export function watchSystemTheme(theme: ThemeMode, onChange: () => void): () => void {
  if (theme !== "system" || typeof window === "undefined" || !window.matchMedia) return () => undefined;
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  const listener = () => onChange();
  query.addEventListener?.("change", listener);
  return () => query.removeEventListener?.("change", listener);
}
