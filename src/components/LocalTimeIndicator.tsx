import { useEffect, useMemo, useState } from "react";
import { Clock3 } from "lucide-react";

const PORTUGAL_TIME_ZONE = "Europe/Lisbon";
const PORTUGAL_ZONES = new Set(["Europe/Lisbon", "Atlantic/Madeira", "Atlantic/Azores"]);

function formatDateTime(date: Date, timeZone?: string) {
  return new Intl.DateTimeFormat("pt-PT", {
    timeZone,
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatMobileTime(date: Date, timeZone?: string) {
  return new Intl.DateTimeFormat("pt-PT", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function localZoneLabel(timeZone: string) {
  const city = timeZone.split("/").pop()?.replace(/_/g, " ") || "Local";
  return city === "Lisbon" ? "Portugal" : city;
}

export default function LocalTimeIndicator() {
  const [now, setNow] = useState(() => new Date());
  const localTimeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || PORTUGAL_TIME_ZONE,
    [],
  );
  const isPortugalZone = PORTUGAL_ZONES.has(localTimeZone);

  useEffect(() => {
    const update = () => setNow(new Date());
    const delay = 60_000 - (Date.now() % 60_000) + 50;
    let interval: ReturnType<typeof setInterval> | undefined;
    const timeout = setTimeout(() => {
      update();
      interval = setInterval(update, 60_000);
    }, delay);
    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, []);

  return (
    <div
      className="pointer-events-none fixed left-1/2 top-1.5 z-[35] flex -translate-x-1/2 items-center gap-1 rounded-full border border-border/60 bg-background/82 px-2 py-1 text-[9px] font-semibold text-foreground/80 shadow-sm backdrop-blur-md sm:text-[10px] md:left-auto md:right-48 md:top-3.5 md:translate-x-0 md:px-2.5"
      title={`Fuso horário do dispositivo: ${localTimeZone}`}
      aria-label={isPortugalZone ? `Hora local: ${formatDateTime(now)}` : `Hora local: ${formatDateTime(now)}; Portugal: ${formatDateTime(now, PORTUGAL_TIME_ZONE)}`}
    >
      <Clock3 className="h-3 w-3 shrink-0 text-muted-foreground" />
      <span className="sm:hidden whitespace-nowrap">
        {isPortugalZone
          ? `${localZoneLabel(localTimeZone)} · ${formatMobileTime(now)}`
          : `${localZoneLabel(localTimeZone)} ${formatMobileTime(now)} · PT ${formatMobileTime(now, PORTUGAL_TIME_ZONE)}`}
      </span>
      <span className="hidden sm:inline whitespace-nowrap">
        {isPortugalZone
          ? `${localZoneLabel(localTimeZone)} · ${formatDateTime(now)}`
          : `${localZoneLabel(localTimeZone)} · ${formatDateTime(now)} | Portugal · ${formatDateTime(now, PORTUGAL_TIME_ZONE)}`}
      </span>
    </div>
  );
}
