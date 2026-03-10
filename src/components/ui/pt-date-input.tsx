import * as React from "react";
import { CalendarDays } from "lucide-react";
import { pt } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatPtDate, maskPtDateInput, parseYmd, ptInputToYmd, ymdToPtInput } from "@/lib/date";

type PtDateInputProps = {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

export function PtDateInput({
  value,
  onChange,
  placeholder = "dd/mm/aaaa",
  className,
  disabled,
}: PtDateInputProps) {
  const [open, setOpen] = React.useState(false);
  const [textValue, setTextValue] = React.useState(ymdToPtInput(value));

  React.useEffect(() => {
    setTextValue(ymdToPtInput(value));
  }, [value]);

  const selectedDate = React.useMemo(() => parseYmd(value), [value]);

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

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Input
        value={textValue}
        placeholder={placeholder}
        inputMode="numeric"
        autoComplete="off"
        disabled={disabled}
        onChange={(event) => setTextValue(maskPtDateInput(event.target.value))}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
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
            size="icon"
            className="shrink-0"
            disabled={disabled}
            aria-label="Selecionar data"
          >
            <CalendarDays className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            locale={pt}
            selected={selectedDate ?? undefined}
            defaultMonth={selectedDate ?? new Date()}
            onSelect={(date) => {
              if (!date) return;
              const normalized = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
              onChange(normalized);
              setTextValue(formatPtDate(normalized));
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
