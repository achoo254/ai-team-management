import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type Seat } from "@/hooks/use-seats";
import { useTeams } from "@/hooks/use-teams";
import { useAuth } from "@/hooks/use-auth";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<Seat, "_id" | "users">) => void;
  loading?: boolean;
  initial?: Seat | null;
}

const empty = { email: "", label: "", team_id: "", max_users: 2 };

export function SeatFormDialog({ open, onClose, onSubmit, loading, initial }: Props) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  // Non-admin sees only own teams; admin sees all
  const { data: teamsData } = useTeams(isAdmin ? undefined : { mine: true });
  const [form, setForm] = useState(empty);

  useEffect(() => {
    setForm(initial
      ? { email: initial.email, label: initial.label, team_id: initial.team_id ?? "", max_users: initial.max_users }
      : empty);
  }, [initial, open]);

  const set = (k: string, v: string | number | null) => { if (v !== null) setForm((f) => ({ ...f, [k]: v })); };
  const teams = teamsData?.teams ?? [];

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
            <div className="relative">
              <Select key={form.team_id || "__empty__"} value={form.team_id || undefined} onValueChange={(v) => set("team_id", v)}>
                <SelectTrigger><SelectValue placeholder="Chọn team" /></SelectTrigger>
                <SelectContent>
                  {teams.map((t) => (
                    <SelectItem key={t._id} value={t._id}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.team_id && (
                <button type="button" onClick={() => set("team_id", "")}
                  className="absolute right-8 top-1/2 -translate-y-1/2 rounded-sm p-0.5 hover:bg-muted">
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
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
