import { useMemo } from "react";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useSeats, type Seat } from "@/hooks/use-seats";
import { useAuth } from "@/hooks/use-auth";

interface DashboardSeatFilterProps {
  /** Currently selected seat IDs. Empty = all available seats (no filter). */
  value: string[];
  onChange: (seatIds: string[]) => void;
}

/** Filter seats by role: admin sees all; regular users only see seats they own */
function filterSeatsByRole(seats: Seat[], userId: string, role: string): Seat[] {
  if (role === "admin") return seats;
  return seats.filter((s) => s.owner_id === userId);
}

export function DashboardSeatFilter({ value, onChange }: DashboardSeatFilterProps) {
  const { user } = useAuth();
  const { data } = useSeats();

  const availableSeats = useMemo(() => {
    if (!data?.seats || !user) return [];
    return filterSeatsByRole(data.seats, user._id, user.role);
  }, [data?.seats, user]);

  // Keep only valid selections (auto-prune if a seat was removed)
  const validValue = useMemo(
    () => value.filter((id) => availableSeats.some((s) => s._id === id)),
    [value, availableSeats],
  );

  const total = availableSeats.length;
  const selectedCount = validValue.length;
  const isAll = selectedCount === 0 || selectedCount === total;

  function toggle(seatId: string) {
    if (validValue.includes(seatId)) {
      onChange(validValue.filter((id) => id !== seatId));
    } else {
      onChange([...validValue, seatId]);
    }
  }

  function selectAll() {
    onChange([]); // empty = all (simpler than listing every id)
  }

  function clearAll() {
    // Select nothing means "none" — but that would hide all data. Interpret as "all" instead.
    onChange([]);
  }

  if (total === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" className="h-9 gap-2">
            <Filter className="h-3.5 w-3.5" />
            <span className="text-sm">
              {isAll ? "Tất cả seats" : "Đã lọc seats"}
            </span>
            {!isAll && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px] tabular-nums">
                {selectedCount}/{total}
              </Badge>
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-64">
        <div className="flex items-center justify-between px-1.5 py-1 text-xs font-medium text-muted-foreground">
          <span>Lọc theo Seat</span>
          <span className="text-[10px] font-normal tabular-nums">
            {isAll ? `Tất cả (${total})` : `${selectedCount}/${total}`}
          </span>
        </div>
        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={selectAll} closeOnClick={false}>
          <span className="text-sm">Chọn tất cả</span>
        </DropdownMenuItem>
        {!isAll && (
          <DropdownMenuItem onClick={clearAll} closeOnClick={false}>
            <X className="h-3.5 w-3.5" />
            <span className="text-sm">Xoá bộ lọc</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />

        <div className="max-h-[260px] overflow-y-auto">
          {availableSeats.map((seat) => {
            const checked = isAll || validValue.includes(seat._id);
            return (
              <DropdownMenuCheckboxItem
                key={seat._id}
                checked={checked}
                closeOnClick={false}
                onCheckedChange={() => {
                  // When in "all" state, clicking a seat means "only this one"
                  if (isAll) {
                    onChange(availableSeats.filter((s) => s._id !== seat._id).map((s) => s._id));
                  } else {
                    toggle(seat._id);
                  }
                }}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                    {seat.team?.name ?? "—"}
                  </span>
                  <span className="truncate text-sm">{seat.label}</span>
                </div>
              </DropdownMenuCheckboxItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
