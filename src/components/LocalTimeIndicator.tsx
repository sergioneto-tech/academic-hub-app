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

function formatMobileDate(date: Date, timeZone?: string) {
  return new Intl.DateTimeFormat("pt-PT", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function formatMobileClock(date: Date, timeZone?: string) {
  return new Intl.DateTimeFormat("pt-PT", {
    timeZone,
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
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let interval: ReturnType<typeof setInterval> | undefined;

    const stop = () => {
      if (timeout) clearTimeout(timeout);
      if (interval) clearInterval(interval);
      timeout = undefined;
      interval = undefined;
    };

    const start = () => {
      stop();
      if (document.visibilityState !== "visible") return;
      setNow(new Date());
      const delay = 60_000 - (Date.now() % 60_000) + 50;
      timeout = setTimeout(() => {
        if (document.visibilityState !== "visible") return;
        setNow(new Date());
        interval = setInterval(() => {
          if (document.visibilityState === "visible") setNow(new Date());
        }, 60_000);
      }, delay);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") start();
      else stop();
    };

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, []);

  return (
    <div
      className="pointer-events-none fixed left-[8.6rem] top-1.5 z-[35] flex max-w-[8.4rem] items-center gap-1 rounded-xl border border-border/60 bg-background/84 px-1.5 py-1 text-[8px] font-semibold leading-tight text-foreground/80 shadow-sm backdrop-blur-md sm:left-1/2 sm:max-w-none sm:-translate-x-1/2 sm:rounded-full sm:px-2.5 sm:text-[10px] md:left-auto md:right-48 md:top-3.5 md:translate-x-0"
      title={`Fuso horário do dispositivo: ${localTimeZone}`}
      aria-label={isPortugalZone ? `Hora local: ${formatDateTime(now)}` : `Hora local: ${formatDateTime(now)}; Portugal: ${formatDateTime(now, PORTUGAL_TIME_ZONE)}`}
    >
      <Clock3 className="h-3 w-3 shrink-0 text-muted-foreground" />

      <div className="min-w-0 sm:hidden">
        {isPortugalZone ? (
          <div className="whitespace-nowrap">
            PT · {formatMobileDate(now)} · {formatMobileClock(now)}
          </div>
        ) : (
          <div className="grid gap-0.5">
            <div className="truncate whitespace-nowrap">Local · {formatMobileClock(now)}</div>
            <div className="whitespace-nowrap">PT · {formatMobileClock(now, PORTUGAL_TIME_ZONE)}</div>
          </div>
        )}
      </div>

      <span className="hidden sm:inline whitespace-nowrap">
        {isPortugalZone
          ? `${localZoneLabel(localTimeZone)} · ${formatDateTime(now)}`
          : `${localZoneLabel(localTimeZone)} · ${formatDateTime(now)} | Portugal · ${formatDateTime(now, PORTUGAL_TIME_ZONE)}`}
      </span>
    </div>
  );
}
