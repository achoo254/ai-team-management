// Devices table with revoke action. Native confirm() keeps it dependency-free.
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRevokeDevice, type Device } from "@/hooks/use-devices";

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("vi-VN");
}

interface Props {
  devices: Device[];
}

export function DevicesTable({ devices }: Props) {
  const revoke = useRevokeDevice();

  const handleRevoke = (device: Device) => {
    if (!window.confirm(`Thu hồi device "${device.device_name}"? Desktop app sẽ không gửi được telemetry nữa.`)) {
      return;
    }
    revoke.mutate(device._id);
  };

  if (devices.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        Chưa có device nào. Tạo device đầu tiên để kết nối Claude Tools desktop app.
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tên</TableHead>
            <TableHead>Hostname</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead>Last seen</TableHead>
            <TableHead>Tạo lúc</TableHead>
            <TableHead className="text-right">Hành động</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {devices.map((d) => {
            const isRevoked = !!d.revoked_at;
            return (
              <TableRow key={d._id} className={isRevoked ? "opacity-60" : undefined}>
                <TableCell className="font-medium">{d.device_name}</TableCell>
                <TableCell className="font-mono text-xs">{d.hostname}</TableCell>
                <TableCell>
                  {isRevoked ? (
                    <Badge variant="secondary">Đã thu hồi</Badge>
                  ) : (
                    <Badge className="bg-emerald-600 hover:bg-emerald-600">Active</Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatRelative(d.last_seen_at)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(d.created_at)}
                </TableCell>
                <TableCell className="text-right">
                  {!isRevoked && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevoke(d)}
                      disabled={revoke.isPending}
                    >
                      Thu hồi
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
