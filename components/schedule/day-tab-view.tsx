"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";
import type { ScheduleEntry, SeatWithUsers } from "@/hooks/use-schedules";

const DAYS = [
  { label: "Thứ 2", day: 1 }, { label: "Thứ 3", day: 2 }, { label: "Thứ 4", day: 3 },
  { label: "Thứ 5", day: 4 }, { label: "Thứ 6", day: 5 },
];
const SLOTS = [
  { key: "morning", label: "Buổi sáng" },
  { key: "afternoon", label: "Buổi chiều" },
] as const;

interface AssignTarget { seatId: string; dayOfWeek: number; slot: string }

interface Props {
  schedules: ScheduleEntry[];
  seats: SeatWithUsers[];
  isAdmin: boolean;
  onAssign: (seatId: string, userId: string, dayOfWeek: number, slot: string) => void;
  onDelete: (seatId: string, dayOfWeek: number, slot: string) => void;
}

export function DayTabView({ schedules, seats, isAdmin, onAssign, onDelete }: Props) {
  const [assignTarget, setAssignTarget] = useState<AssignTarget | null>(null);
  const [selectedUser, setSelectedUser] = useState("");

  const lookup = new Map<string, ScheduleEntry>();
  for (const s of schedules) lookup.set(`${s.seat_id}-${s.day_of_week}-${s.slot}`, s);

  function handleAssign() {
    if (!assignTarget || !selectedUser) return;
    onAssign(assignTarget.seatId, selectedUser, assignTarget.dayOfWeek, assignTarget.slot);
    setAssignTarget(null);
    setSelectedUser("");
  }

  // Collect all users from all seats for assign dialog
  const allUsers = seats.flatMap((s) => (s.users ?? []).map((u) => ({ ...u, seatLabel: s.label })));

  return (
    <div className="lg:hidden">
      <Tabs defaultValue="1">
        <TabsList className="w-full grid grid-cols-5 mb-4">
          {DAYS.map((d) => (
            <TabsTrigger key={d.day} value={String(d.day)} className="text-xs">{d.label}</TabsTrigger>
          ))}
        </TabsList>
        {DAYS.map((d) => (
          <TabsContent key={d.day} value={String(d.day)} className="space-y-3">
            {seats.map((seat) => (
              <Card key={seat._id}>
                <CardContent className="pt-3 pb-3 px-4 space-y-2">
                  <p className="text-sm font-semibold">{seat.label}</p>
                  {SLOTS.map(({ key, label }) => {
                    const entry = lookup.get(`${seat._id}-${d.day}-${key}`);
                    return (
                      <div key={key} className="flex items-center justify-between gap-2 py-1 border-t border-border">
                        <span className="text-xs text-muted-foreground w-24 shrink-0">{label}</span>
                        {entry ? (
                          <div className="flex items-center gap-2 flex-1">
                            <Badge variant="outline" className="text-xs">{entry.user_name}</Badge>
                            {isAdmin && (
                              <button onClick={() => onDelete(seat._id, d.day, key)}
                                className="ml-auto p-1 rounded hover:bg-red-100 text-red-500">
                                <X size={12} />
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="flex-1 flex items-center">
                            <span className="text-xs text-muted-foreground italic">Trống</span>
                            {isAdmin && (
                              <Button variant="ghost" size="sm" className="ml-auto h-6 text-xs"
                                onClick={() => { setAssignTarget({ seatId: seat._id, dayOfWeek: d.day, slot: key }); setSelectedUser(""); }}>
                                + Phân ca
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={!!assignTarget} onOpenChange={(o) => !o && setAssignTarget(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>Phân ca thành viên</DialogTitle></DialogHeader>
          <Select value={selectedUser} onValueChange={(v) => setSelectedUser(v ?? "")}>
            <SelectTrigger><SelectValue placeholder="Chọn thành viên" /></SelectTrigger>
            <SelectContent>
              {allUsers.map((u) => (
                <SelectItem key={u._id} value={u._id}>{u.name} ({u.seatLabel})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleAssign} disabled={!selectedUser} className="w-full">Xác nhận</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
