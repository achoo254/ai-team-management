import { Button } from "@/components/ui/button";

interface SeatRestoreBannerProps {
  seat: { _id: string; label: string; deleted_at: string; has_history: boolean };
  onRestore: () => void;
  onCreateNew: () => void;
  loading?: boolean;
}

export function SeatRestoreBanner({ seat, onRestore, onCreateNew, loading }: SeatRestoreBannerProps) {
  const deletedDate = new Date(seat.deleted_at).toLocaleDateString("vi-VN");

  return (
    <div className="rounded-md border border-amber-500/50 bg-amber-500/5 p-4 space-y-3">
      <div className="text-sm font-medium">Seat đã xóa trước đó</div>
      <p className="text-sm text-muted-foreground">
        Seat <strong>{seat.label}</strong> đã bị xóa ngày {deletedDate}.
        {seat.has_history && " Dữ liệu sử dụng cũ vẫn còn lưu."}
      </p>
      <p className="text-sm">Bạn muốn khôi phục (giữ dữ liệu cũ) hay tạo mới?</p>
      <div className="flex gap-2">
        <Button variant="default" size="sm" onClick={onRestore} disabled={loading}>
          {loading ? "Đang xử lý..." : "Khôi phục"}
        </Button>
        <Button variant="outline" size="sm" onClick={onCreateNew} disabled={loading}>
          Tạo mới
        </Button>
      </div>
    </div>
  );
}
