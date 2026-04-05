import type { AvailableSeat } from "@/hooks/use-user-settings";

const ALERT_TYPES = [
  { value: "", label: "Tất cả loại" },
  { value: "rate_limit", label: "Rate Limit" },
  { value: "token_failure", label: "Token Error" },
  { value: "usage_exceeded", label: "Vượt Budget" },
  { value: "session_waste", label: "Lãng phí" },
  { value: "7d_risk", label: "7d Risk" },
];

interface Props {
  type: string;
  seat: string;
  onTypeChange: (v: string) => void;
  onSeatChange: (v: string) => void;
  seats: AvailableSeat[];
}

export function AlertFeedFilters({ type, seat, onTypeChange, onSeatChange, seats }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      <select
        value={type}
        onChange={(e) => onTypeChange(e.target.value)}
        className="rounded-md border bg-background px-3 py-1.5 text-sm"
      >
        {ALERT_TYPES.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>
      <select
        value={seat}
        onChange={(e) => onSeatChange(e.target.value)}
        className="rounded-md border bg-background px-3 py-1.5 text-sm"
      >
        <option value="">Tất cả seat</option>
        {seats.map((s) => (
          <option key={s._id} value={s._id}>{s.label || s.email}</option>
        ))}
      </select>
    </div>
  );
}
