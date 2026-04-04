import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type AdminUser } from "@/hooks/use-admin";
import { useTeams } from "@/hooks/use-teams";
import { useSeats } from "@/hooks/use-seats";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<AdminUser> & { seat_ids?: string[] }) => void;
  loading?: boolean;
  initial?: AdminUser | null;
}

type FormState = { name: string; email: string; role: "admin" | "user"; team_ids: string[]; seat_ids: string[] };
const empty: FormState = { name: "", email: "", role: "user", team_ids: [], seat_ids: [] };

export function UserFormDialog({ open, onClose, onSubmit, loading, initial }: Props) {
  const [form, setForm] = useState<FormState>(empty);
  const { data: teamsData } = useTeams();
  const { data: seatsData } = useSeats();

  useEffect(() => {
    setForm(initial
      ? { name: initial.name, email: initial.email, role: initial.role, team_ids: initial.team_ids ?? [], seat_ids: (initial.seat_ids ?? []).map(String) }
      : empty);
  }, [initial, open]);

  const set = (k: string, v: string | null) => { if (v !== null) setForm((f) => ({ ...f, [k]: v })); };

  const teams = teamsData?.teams ?? [];
  const seats = seatsData?.seats ?? [];
  const selectedTeamIds = new Set(form.team_ids);
  const availableTeams = teams.filter((t) => !selectedTeamIds.has(t._id));
  const selectedSeatIds = new Set(form.seat_ids);
  const availableSeats = seats.filter((s) => !selectedSeatIds.has(s._id));

  const addTeam = (teamId: string) => setForm((f) => ({ ...f, team_ids: [...f.team_ids, teamId] }));
  const removeTeam = (teamId: string) => setForm((f) => ({ ...f, team_ids: f.team_ids.filter((id) => id !== teamId) }));
  const addSeat = (seatId: string) => setForm((f) => ({ ...f, seat_ids: [...f.seat_ids, seatId] }));
  const removeSeat = (seatId: string) => setForm((f) => ({ ...f, seat_ids: f.seat_ids.filter((id) => id !== seatId) }));

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
            <Label>Teams</Label>
            <div className="flex flex-wrap gap-1 mb-1">
              {form.team_ids.map((tid) => {
                const t = teams.find((x) => x._id === tid);
                return (
                  <Badge key={tid} variant="outline" className="gap-1 pr-1">
                    {t?.name ?? tid}
                    <button type="button" onClick={() => removeTeam(tid)} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>
            {availableTeams.length > 0 && (
              <Select value="" onValueChange={(v) => { if (v) addTeam(v); }}>
                <SelectTrigger><SelectValue placeholder="Thêm team..." /></SelectTrigger>
                <SelectContent>
                  {availableTeams.map((t) => (
                    <SelectItem key={t._id} value={t._id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label>Seats</Label>
            <div className="flex flex-wrap gap-1 mb-1">
              {form.seat_ids.map((sid) => {
                const s = seats.find((x) => x._id === sid);
                return (
                  <Badge key={sid} variant="outline" className="gap-1 pr-1">
                    {s?.label ?? s?.email ?? sid}
                    <button type="button" onClick={() => removeSeat(sid)} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>
            {availableSeats.length > 0 && (
              <Select value="" onValueChange={(v) => { if (v) addSeat(v); }}>
                <SelectTrigger><SelectValue placeholder="Thêm seat..." /></SelectTrigger>
                <SelectContent>
                  {availableSeats.map((s) => (
                    <SelectItem key={s._id} value={s._id}>{s.label || s.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
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
