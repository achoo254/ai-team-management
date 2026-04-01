
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { type UsageLogEntry } from "@/hooks/use-usage-log";

interface Props {
  entries: UsageLogEntry[];
  isAdmin: boolean;
  onChange: (seatId: string, field: "weeklyAllPct", value: number) => void;
}

export function WeekTable({ entries, isAdmin, onChange }: Props) {
  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Seat</TableHead>
            <TableHead>Team</TableHead>
            <TableHead>Usage %</TableHead>
            <TableHead>Logged</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((row) => (
            <TableRow key={row.seatId}>
              <TableCell>
                <div className="font-medium">{row.seatLabel}</div>
                <div className="text-xs text-muted-foreground">{row.seatEmail}</div>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">{row.team}</Badge>
              </TableCell>
              <TableCell>
                {isAdmin ? (
                  <Input type="number" min={0} max={100} className="w-20 h-7 text-sm"
                    value={row.weeklyAllPct ?? 0}
                    onChange={(e) => onChange(row.seatId, "weeklyAllPct", Number(e.target.value))} />
                ) : (
                  <span>{row.weeklyAllPct ?? 0}%</span>
                )}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {row.loggedAt ? new Date(row.loggedAt).toLocaleDateString("vi-VN") : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
