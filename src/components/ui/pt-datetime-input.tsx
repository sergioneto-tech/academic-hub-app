import { Input } from "@/components/ui/input";
import { PtDateInput } from "@/components/ui/pt-date-input";
import { normalizeDateTimeLocal } from "@/lib/date";

type PtDateTimeInputProps = {
  value?: string;
  onChange: (value: string) => void;
};

export function PtDateTimeInput({ value, onChange }: PtDateTimeInputProps) {
  const normalized = normalizeDateTimeLocal(value);
  const [datePart = "", timePart = "09:00"] = normalized.split("T");

  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_120px]">
      <PtDateInput
        value={datePart}
        onChange={(nextDate) => {
          if (!nextDate) {
            onChange("");
            return;
          }
          onChange(`${nextDate}T${timePart || "09:00"}`);
        }}
      />
      <Input
        type="time"
        value={timePart || "09:00"}
        onChange={(event) => {
          if (!datePart) {
            const today = new Date();
            const fallbackDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
            onChange(`${fallbackDate}T${event.target.value}`);
            return;
          }
          onChange(`${datePart}T${event.target.value}`);
        }}
      />
    </div>
  );
}
