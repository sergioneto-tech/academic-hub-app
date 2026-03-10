export function isValidYmd(value?: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function parseYmd(value?: string | null): Date | null {
  const raw = String(value ?? "").trim();
  const normalized = /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : raw;
  if (!isValidYmd(normalized)) return null;
  const [year, month, day] = normalized.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function formatPtDate(value?: string | null): string {
  const date = parseYmd(value);
  if (!date) return value ? String(value) : "";
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatPtDateTime(value?: string | null): string {
  if (!value) return "";
  const [datePart, timePart] = String(value).split("T");
  const dateLabel = formatPtDate(datePart);
  if (!timePart) return dateLabel;
  const [hours = "", minutes = ""] = timePart.slice(0, 5).split(":");
  if (!hours || !minutes) return dateLabel;
  return `${dateLabel}, ${hours}:${minutes}`;
}

export function ymdToPtInput(value?: string | null): string {
  return formatPtDate(value);
}

export function maskPtDateInput(rawValue: string): string {
  const digits = String(rawValue ?? "").replace(/\D/g, "").slice(0, 8);
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);

  if (digits.length <= 2) return day;
  if (digits.length <= 4) return `${day}/${month}`;
  return `${day}/${month}/${year}`;
}

export function ptInputToYmd(value?: string | null): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 8) return null;

  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));
  const date = new Date(year, month - 1, day);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function normalizeDateTimeLocal(value?: string | null): string {
  if (!value) return "";
  if (String(value).includes("T")) return String(value).slice(0, 16);
  return `${String(value).slice(0, 10)}T09:00`;
}
