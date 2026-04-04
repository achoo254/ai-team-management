
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type Seat } from "@/hooks/use-seats";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<Seat, "_id" | "users">) => void;
  loading?: boolean;
  initial?: Seat | null;
}

const empty = { email: "", label: "", team: "personal", max_users: 2 };

export function SeatFormDialog({ open, onClose, onSubmit, loading, initial }: Props) {
  const [form, setForm] = useState(empty);

  useEffect(() => {
    setForm(initial ? { email: initial.email, label: initial.label, team: initial.team, max_users: initial.max_users } : empty);
  }, [initial, open]);

  const set = (k: string, v: string | number | null) => { if (v !== null) setForm((f) => ({ ...f, [k]: v })); };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial ? "Sửa Seat" : "Thêm Seat"}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Email</Label>
            <Input value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="claude@example.com" />
          </div>
          <div className="grid gap-1.5">
            <Label>Label</Label>
            <Input value={form.label} onChange={(e) => set("label", e.target.value)} placeholder="Seat A" />
          </div>
          <div className="grid gap-1.5">
            <Label>Team</Label>
            <Select value={form.team} onValueChange={(v) => set("team", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="personal">Personal</SelectItem>
                <SelectItem value="dev">Dev</SelectItem>
                <SelectItem value="mkt">MKT</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Số user tối đa</Label>
            <Input type="number" min={1} max={10} value={form.max_users}
              onChange={(e) => set("max_users", Number(e.target.value))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Huỷ</Button>
          <Button onClick={() => onSubmit(form as Omit<Seat, "_id" | "users">)} disabled={loading || !form.email || !form.label}>
            {loading ? "Đang lưu..." : "Lưu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
