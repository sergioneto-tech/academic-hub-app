import * as React from "react";
import { CalendarDays } from "lucide-react";
import { pt } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAppStore } from "@/lib/AppStore";
import { cn } from "@/lib/utils";
import { formatPtDate, maskPtDateInput, parseYmd, ptInputToYmd, ymdToPtInput } from "@/lib/date";

type PtDateInputProps = {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

function toDateOnly(value?: string | null): string | null {
  const raw = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(raw)) return null;
  return raw.slice(0, 10);
}

export function PtDateInput({
  value,
  onChange,
  placeholder = "dd/mm/aaaa",
  className,
  disabled,
}: PtDateInputProps) {
  const { state } = useAppStore();
  const [open, setOpen] = React.useState(false);
  const [textValue, setTextValue] = React.useState(ymdToPtInput(value));
  const [coarsePointer, setCoarsePointer] = React.useState(false);

  React.useEffect(() => {
    setTextValue(ymdToPtInput(value));
  }, [value]);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const media = window.matchMedia("(pointer: coarse)");
    const update = () => setCoarsePointer(media.matches);
    update();

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }

    media.addListener?.(update);
    return () => media.removeListener?.(update);
  }, []);

  const selectedDate = React.useMemo(() => parseYmd(value), [value]);

  const academicEventDates = React.useMemo(() => {
    const dates = new Set<string>();

    for (const assessment of state.assessments) {
      for (const candidate of [
        assessment.startDate,
        assessment.endDate,
        assessment.gradeReleaseDate,
        assessment.date,
      ]) {
        const date = toDateOnly(candidate);
        if (date) dates.add(date);
      }
    }

    for (const course of state.courses) {
      for (const session of course.sessions ?? []) {
        const date = toDateOnly(session.dateTime);
        if (date) dates.add(date);
      }
    }

    for (const block of state.studyBlocks ?? []) {
      const start = toDateOnly(block.startDate);
      const end = toDateOnly(block.endDate);
      if (start) dates.add(start);
      if (end) dates.add(end);
    }

    return Array.from(dates)
      .map((date) => parseYmd(date))
      .filter((date): date is Date => Boolean(date));
  }, [state.assessments, state.courses, state.studyBlocks]);

  function commit(rawValue: string) {
    const normalized = ptInputToYmd(rawValue);

    if (!rawValue.trim()) {
      setTextValue("");
      onChange("");
      return;
    }

    if (normalized) {
      setTextValue(formatPtDate(normalized));
      onChange(normalized);
      return;
    }

    setTextValue(value ? formatPtDate(value) : "");
  }

  function selectDate(date?: Date) {
    if (!date) return;
    const normalized = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    onChange(normalized);
    setTextValue(formatPtDate(normalized));
    setOpen(false);
  }

  return (
    <div className={cn("flex min-w-0 items-stretch", className)}>
      <Input
        value={textValue}
        placeholder={coarsePointer ? "Selecionar data" : placeholder}
        inputMode={coarsePointer ? "none" : "numeric"}
        autoComplete="off"
        disabled={disabled}
        readOnly={coarsePointer}
        className="relative min-w-0 rounded-r-none border-r-0 focus-visible:z-10"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (coarsePointer && !disabled) setOpen(true);
        }}
        onChange={(event) => setTextValue(maskPtDateInput(event.target.value))}
        onBlur={(event) => {
          if (!coarsePointer) commit(event.target.value);
        }}
        onKeyDown={(event) => {
          if (coarsePointer && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            setOpen(true);
            return;
          }
          if (!coarsePointer && event.key === "Enter") {
            commit(textValue);
            (event.target as HTMLInputElement).blur();
          }
        }}
      />

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="h-10 shrink-0 rounded-l-none border-l-0 px-3 text-primary hover:text-primary"
            disabled={disabled}
            aria-label="Abrir calendário para selecionar data"
          >
            <CalendarDays className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border-primary/25 bg-popover p-0 shadow-xl"
          align="end"
          sideOffset={8}
        >
          <div className="border-b bg-muted/20 px-4 py-3">
            <div className="text-sm font-semibold">Selecionar data</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              Toca num dia para preencher automaticamente.
            </div>
          </div>

          <Calendar
            mode="single"
            locale={pt}
            selected={selectedDate ?? undefined}
            defaultMonth={selectedDate ?? new Date()}
            modifiers={academicEventDates.length > 0 ? { academicEvent: academicEventDates } : undefined}
            modifiersClassNames={{
              academicEvent: "ring-1 ring-inset ring-primary/45",
            }}
            onSelect={selectDate}
          />

          {academicEventDates.length > 0 && (
            <div className="flex items-center gap-2 border-t px-4 py-2.5 text-[11px] text-muted-foreground">
              <span className="h-2 w-2 rounded-full border border-primary bg-primary/20" aria-hidden="true" />
              Dias assinalados já têm eventos no Academic Hub.
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
