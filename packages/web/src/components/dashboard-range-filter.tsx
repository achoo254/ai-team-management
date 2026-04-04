import type { DashboardRange } from "@/hooks/use-dashboard";

const RANGES: { value: DashboardRange; label: string }[] = [
  { value: "day", label: "Ngày" },
  { value: "week", label: "Tuần" },
  { value: "month", label: "Tháng" },
  { value: "3month", label: "3 Tháng" },
  { value: "6month", label: "6 Tháng" },
];

interface DashboardRangeFilterProps {
  value: DashboardRange;
  onChange: (range: DashboardRange) => void;
}

export function DashboardRangeFilter({ value, onChange }: DashboardRangeFilterProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
      {RANGES.map((r) => (
        <button
          key={r.value}
          onClick={() => onChange(r.value)}
          className={`
            px-3 py-1.5 text-sm font-medium rounded-md transition-all
            ${value === r.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
            }
          `}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
