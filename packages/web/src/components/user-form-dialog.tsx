
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type AdminUser } from "@/hooks/use-admin";
import { useTeams } from "@/hooks/use-teams";
import { useSeats } from "@/hooks/use-seats";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<AdminUser> & { seatId?: string }) => void;
  loading?: boolean;
  initial?: AdminUser | null;
}

type FormState = { name: string; email: string; role: "admin" | "user"; team: string; seatId: string };
const empty: FormState = { name: "", email: "", role: "user", team: "", seatId: "" };

export function UserFormDialog({ open, onClose, onSubmit, loading, initial }: Props) {
  const [form, setForm] = useState<FormState>(empty);
  const { data: teamsData } = useTeams();
  const { data: seatsData } = useSeats();

  useEffect(() => {
    setForm(initial
      ? { name: initial.name, email: initial.email, role: initial.role, team: initial.team ?? "", seatId: initial.seat_ids?.[0] ?? "" }
      : empty);
  }, [initial, open]);

  const set = (k: string, v: string | null) => { if (v !== null) setForm((f) => ({ ...f, [k]: v })); };

  const teams = teamsData?.teams ?? [];
  const seats = seatsData?.seats ?? [];

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
              <div className="relative">
                <Select key={form.team || "__empty__"} value={form.team || undefined} onValueChange={(v) => set("team", v)}>
                  <SelectTrigger><SelectValue placeholder="Chọn team" /></SelectTrigger>
                  <SelectContent>
                    {teams.map((t) => (
                      <SelectItem key={t._id} value={t.name}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.team && (
                  <button type="button" onClick={() => set("team", "")}
                    className="absolute right-8 top-1/2 -translate-y-1/2 rounded-sm p-0.5 hover:bg-muted">
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Seat (tuỳ chọn)</Label>
            <div className="relative">
              <Select key={form.seatId || "__empty__"} value={form.seatId || undefined} onValueChange={(v) => set("seatId", v)}>
                <SelectTrigger><SelectValue placeholder="Chọn seat" /></SelectTrigger>
                <SelectContent>
                  {seats.map((s) => (
                    <SelectItem key={s._id} value={s._id}>{s.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.seatId && (
                <button type="button" onClick={() => set("seatId", "")}
                  className="absolute right-8 top-1/2 -translate-y-1/2 rounded-sm p-0.5 hover:bg-muted">
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
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
