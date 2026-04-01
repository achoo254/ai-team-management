
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type AdminUser } from "@/hooks/use-admin";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<AdminUser> & { seatId?: string }) => void;
  loading?: boolean;
  initial?: AdminUser | null;
}

type FormState = { name: string; email: string; role: "admin" | "user"; team: string; seatId: string };
const empty: FormState = { name: "", email: "", role: "user", team: "dev", seatId: "" };

export function UserFormDialog({ open, onClose, onSubmit, loading, initial }: Props) {
  const [form, setForm] = useState<FormState>(empty);

  useEffect(() => {
    setForm(initial
      ? { name: initial.name, email: initial.email, role: initial.role, team: initial.team, seatId: initial.seat_id ?? "" }
      : empty);
  }, [initial, open]);

  const set = (k: string, v: string | null) => { if (v !== null) setForm((f) => ({ ...f, [k]: v })); };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial ? "Sửa User" : "Thêm User"}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Tên</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Nguyễn Văn A" />
          </div>
          <div className="grid gap-1.5">
            <Label>Email</Label>
            <Input value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="user@example.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => set("role", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Team</Label>
              <Select value={form.team} onValueChange={(v) => set("team", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dev">Dev</SelectItem>
                  <SelectItem value="mkt">MKT</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Seat ID (tuỳ chọn)</Label>
            <Input value={form.seatId} onChange={(e) => set("seatId", e.target.value)} placeholder="ObjectId của seat" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Huỷ</Button>
          <Button onClick={() => onSubmit(form)} disabled={loading || !form.name || !form.email}>
            {loading ? "Đang lưu..." : "Lưu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
