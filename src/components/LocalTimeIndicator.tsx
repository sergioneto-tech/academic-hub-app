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
      className="pointer-events-none fixed right-[7.25rem] top-2 z-[35] hidden items-center gap-1.5 rounded-full border border-border/60 bg-background/72 px-2.5 py-1 text-[10px] text-muted-foreground shadow-sm backdrop-blur-md sm:flex md:right-32 md:top-3.5 lg:right-36"
      title={`Fuso horário do dispositivo: ${localTimeZone}`}
      aria-label={isPortugalZone ? `Hora local: ${formatDateTime(now)}` : `Hora local: ${formatDateTime(now)}; Portugal: ${formatDateTime(now, PORTUGAL_TIME_ZONE)}`}
    >
      <Clock3 className="h-3 w-3 shrink-0" />
      {isPortugalZone ? (
        <span className="whitespace-nowrap">{localZoneLabel(localTimeZone)} · {formatDateTime(now)}</span>
      ) : (
        <>
          <span className="whitespace-nowrap">{localZoneLabel(localTimeZone)} · {formatDateTime(now)}</span>
          <span className="text-border">|</span>
          <span className="whitespace-nowrap">Portugal · {formatDateTime(now, PORTUGAL_TIME_ZONE)}</span>
        </>
      )}
    </div>
  );
}
