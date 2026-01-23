export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/**
 * Aceita número PT:
 * - "3,40" -> 3.4
 * - "3.40" -> 3.4
 * - "1.234,56" -> 1234.56
 */
export function parsePtNumber(input: string): number | null {
  const raw = String(input ?? "").trim();
  if (!raw) return null;

  let s = raw.replace(/\s+/g, "");

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    // assume . milhares e , decimais
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    s = s.replace(",", ".");
  }

  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

export function formatPtNumber(n: number | null, maxFractionDigits = 2): string {
  if (n === null || !Number.isFinite(n)) return "";
  return n.toLocaleString("pt-PT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  });
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** arredonda "half up" para inteiro (>= .5 sobe) */
export function roundHalfUpInt(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.floor(x + 0.5);
}
