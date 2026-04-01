
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type Team } from "@/hooks/use-teams";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Pick<Team, "name" | "label" | "color">) => void;
  loading?: boolean;
  initial?: Team | null;
}

const COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#3b82f6", "#8b5cf6", "#ec4899"];
const empty = { name: "", label: "", color: "#6366f1" };

export function TeamFormDialog({ open, onClose, onSubmit, loading, initial }: Props) {
  const [form, setForm] = useState(empty);

  useEffect(() => {
    setForm(initial ? { name: initial.name, label: initial.label, color: initial.color } : empty);
  }, [initial, open]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial ? "Sửa Team" : "Thêm Team"}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Name (slug)</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)}
              placeholder="dev" disabled={!!initial} />
          </div>
          <div className="grid gap-1.5">
            <Label>Label</Label>
            <Input value={form.label} onChange={(e) => set("label", e.target.value)} placeholder="Development" />
          </div>
          <div className="grid gap-1.5">
            <Label>Màu</Label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button key={c} onClick={() => set("color", c)}
                  className="h-7 w-7 rounded-full border-2 transition-all"
                  style={{ backgroundColor: c, borderColor: form.color === c ? "#000" : "transparent" }} />
              ))}
              <Input type="color" value={form.color} onChange={(e) => set("color", e.target.value)} className="h-7 w-16 p-0.5 cursor-pointer" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Huỷ</Button>
          <Button onClick={() => onSubmit(form)} disabled={loading || !form.name || !form.label}>
            {loading ? "Đang lưu..." : "Lưu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
