import { useMemo } from "react";
import { Filter, CheckSquare, Square, RotateCcw, UserRound } from "lucide-react";
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

/** Sentinel value representing "explicitly unselect all" — distinct from [] (which means "all"). */
export const SEAT_FILTER_NONE = "__NONE__";

interface DashboardSeatFilterProps {
  /**
   * Currently selected seat IDs.
   * - `[]` = all available seats (default, no filter)
   * - `[SEAT_FILTER_NONE]` = explicitly none (show no data)
   * - `[...ids]` = filter to listed seats
   */
  value: string[];
  onChange: (seatIds: string[]) => void;
  /** Compact variant (h-7, smaller padding) for use inside card headers. */
  compact?: boolean;
  /** Override mode: when true, filter is overriding global dashboard filter. */
  isOverride?: boolean;
  /** Reset card filter back to global (only shown when isOverride=true). */
  onReset?: () => void;
}

/** Filter seats by role: admin sees all; regular users only see seats they own */
function filterSeatsByRole(seats: Seat[], userId: string, role: string): Seat[] {
  if (role === "admin") return seats;
  return seats.filter((s) => s.owner_id === userId);
}

export function DashboardSeatFilter({ value, onChange, compact, isOverride, onReset }: DashboardSeatFilterProps) {
  const { user } = useAuth();
  const { data } = useSeats();

  const availableSeats = useMemo(() => {
    if (!data?.seats || !user) return [];
    return filterSeatsByRole(data.seats, user._id, user.role);
  }, [data?.seats, user]);

  // Seats where current user is owner (for "Chỉ của tôi" preset).
  // For non-admin, this = availableSeats (already scoped to owned). For admin, stricter filter.
  const myOwnedSeatIds = useMemo(
    () => (user ? availableSeats.filter((s) => s.owner_id === user._id).map((s) => s._id) : []),
    [availableSeats, user],
  );
  const hasOwnedSeats = myOwnedSeatIds.length > 0;

  const isNone = value.length === 1 && value[0] === SEAT_FILTER_NONE;

  // Keep only valid selections (auto-prune if a seat was removed)
  const validValue = useMemo(
    () => (isNone ? [] : value.filter((id) => availableSeats.some((s) => s._id === id))),
    [value, availableSeats, isNone],
  );

  const total = availableSeats.length;
  const selectedCount = validValue.length;
  const isAll = !isNone && (selectedCount === 0 || selectedCount === total);

  function toggle(seatId: string) {
    if (validValue.includes(seatId)) {
      const next = validValue.filter((id) => id !== seatId);
      // If removing last seat → explicit "none" (not empty=all)
      onChange(next.length === 0 ? [SEAT_FILTER_NONE] : next);
    } else {
      onChange([...validValue, seatId]);
    }
  }

  function selectAll() {
    onChange([]); // empty = all
  }

  function unselectAll() {
    onChange([SEAT_FILTER_NONE]);
  }

  function selectOnlyMine() {
    onChange(myOwnedSeatIds);
  }

  if (total === 0) return null;

  // Compact variant uses smaller footprint + label conveys override state
  const stateLabel = isNone ? "Không có" : isAll ? "Tất cả" : `${selectedCount}/${total}`;
  const triggerLabel = compact
    ? isOverride
      ? stateLabel
      : "Global"
    : isNone ? "Không chọn seat" : isAll ? "Tất cả seats" : "Đã lọc seats";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant={compact && !isOverride ? "ghost" : "outline"}
            size="sm"
            className={
              compact
                ? `h-7 gap-1.5 px-2 text-xs ${isOverride ? (isNone ? "border-destructive/50 text-destructive" : "border-primary/40 text-primary") : "text-muted-foreground"}`
                : "h-9 gap-2"
            }
          >
            <Filter className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
            <span className={compact ? "text-xs" : "text-sm"}>{triggerLabel}</span>
            {!compact && !isAll && !isNone && (
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
            {isNone ? "Không có" : isAll ? `Tất cả (${total})` : `${selectedCount}/${total}`}
          </span>
        </div>
        <DropdownMenuSeparator />

        {isOverride && onReset && (
          <>
            <DropdownMenuItem onClick={onReset} closeOnClick={true}>
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="text-sm">Theo bộ lọc global</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuItem onClick={selectAll} closeOnClick={false} disabled={isAll}>
          <CheckSquare className="h-3.5 w-3.5" />
          <span className="text-sm">Chọn tất cả</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={unselectAll} closeOnClick={false} disabled={isNone}>
          <Square className="h-3.5 w-3.5" />
          <span className="text-sm">Bỏ chọn tất cả</span>
        </DropdownMenuItem>
        {hasOwnedSeats && myOwnedSeatIds.length < availableSeats.length && (
          <DropdownMenuItem onClick={selectOnlyMine} closeOnClick={false}>
            <UserRound className="h-3.5 w-3.5" />
            <span className="text-sm">Chỉ seats của tôi ({myOwnedSeatIds.length})</span>
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
                  // When in "all" state, clicking a checked seat = uncheck it (keep others)
                  if (isAll) {
                    onChange(availableSeats.filter((s) => s._id !== seat._id).map((s) => s._id));
                  } else {
                    toggle(seat._id);
                  }
                }}
              >
                <span className="truncate text-sm">{seat.label}</span>
              </DropdownMenuCheckboxItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
