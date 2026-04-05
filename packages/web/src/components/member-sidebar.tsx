
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Separator } from "@/components/ui/separator";
import type { SeatWithUsers } from "@/hooks/use-schedules";

interface Props {
  seats: SeatWithUsers[];
  isAdmin: boolean;
}

function DraggableMember({ userId, userName, seatId }: {
  userId: string; userName: string; seatId: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `member-${userId}-${seatId}`,
    data: { type: "member", userId, userName, seatId },
  });
  const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}
      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-grab active:cursor-grabbing select-none">
      <span className="text-sm truncate flex-1">{userName}</span>
    </div>
  );
}

export function MemberSidebar({ seats, isAdmin }: Props) {
  if (!isAdmin) return null;

  return (
    <aside className="hidden lg:flex flex-col w-56 border-l pl-4 gap-3 shrink-0">
      <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Thành viên</p>
      <p className="text-xs text-muted-foreground">Kéo thả vào ô để phân ca</p>
      <Separator />
      <div className="flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-200px)]">
        {seats.map((seat) => (
          <div key={seat._id}>
            <p className="text-xs font-medium text-muted-foreground px-2 mb-1 truncate">{seat.label}</p>
            {(seat.users ?? []).map((user, i) => (
              <DraggableMember
                key={`${seat._id}-${user._id ?? i}`}
                userId={user._id}
                userName={user.name}
                seatId={seat._id}
              />
            ))}
            {(!seat.users || seat.users.length === 0) && (
              <p className="text-xs text-muted-foreground px-2 italic">Chưa có thành viên</p>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}
