// Filters: date range (native date inputs) + seat selector.
// KISS: native date inputs avoid Popover/Calendar dependency.
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSeats, type Seat } from "@/hooks/use-seats";
import type { ClaudeSessionsFilters } from "@/hooks/use-claude-sessions";

const ALL_SEATS = "__all__";

interface Props {
  filters: ClaudeSessionsFilters;
  onChange: (next: ClaudeSessionsFilters) => void;
}

function toDateInputValue(iso?: string): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function fromDateInputValue(v: string, endOfDay = false): string | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  if (endOfDay) d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

export function ClaudeSessionsFilters({ filters, onChange }: Props) {
  const { data } = useSeats();
  const seats: Seat[] = data?.seats ?? [];

  // Resolve display label so we never show raw ObjectID in the trigger
  const selectedLabel = filters.seat_id
    ? seats.find((s) => s._id === filters.seat_id)?.label
      || seats.find((s) => s._id === filters.seat_id)?.email
      || "Đang tải…"
    : undefined;

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor="since" className="text-xs">Từ ngày</Label>
        <input
          id="since"
          type="date"
          value={toDateInputValue(filters.since)}
          onChange={(e) => onChange({ ...filters, since: fromDateInputValue(e.target.value) })}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="until" className="text-xs">Đến ngày</Label>
        <input
          id="until"
          type="date"
          value={toDateInputValue(filters.until)}
          onChange={(e) => onChange({ ...filters, until: fromDateInputValue(e.target.value, true) })}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        />
      </div>
      <div className="space-y-1 min-w-[200px]">
        <Label className="text-xs">Seat</Label>
        <Select
          value={filters.seat_id || ALL_SEATS}
          onValueChange={(v) => {
            const val = typeof v === "string" ? v : ALL_SEATS;
            onChange({ ...filters, seat_id: val === ALL_SEATS ? undefined : val });
          }}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Tất cả seats">
              {selectedLabel ?? "Tất cả seats"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_SEATS}>Tất cả seats</SelectItem>
            {seats.map((s) => (
              <SelectItem key={s._id} value={s._id}>
                {s.label || s.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
