import { ArrowRightLeft, Scale, PlusCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { RebalanceSuggestion } from "@repo/shared/types";

interface Props {
  suggestions: RebalanceSuggestion[];
  /** When true, hides Apply buttons (non-admin read-only mode). */
  readOnly?: boolean;
}

function MoveMemberCard({
  s,
  readOnly,
}: {
  s: Extract<RebalanceSuggestion, { type: "move_member" }>;
  readOnly?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <ArrowRightLeft className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
          <div className="min-w-0">
            <p className="text-sm font-medium">Di chuyển member</p>
            <p className="text-xs text-muted-foreground">
              {s.fromSeatLabel} → {s.toSeatLabel}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{s.reason}</p>
          </div>
        </div>
        {!readOnly && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 shrink-0 text-xs"
            onClick={() => console.log("[BLD] Apply move_member", s)}
          >
            Áp dụng
          </Button>
        )}
      </div>
    </div>
  );
}

function RebalanceSeatCard({
  s,
  readOnly,
}: {
  s: Extract<RebalanceSuggestion, { type: "rebalance_seat" }>;
  readOnly?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <Scale className="mt-0.5 h-4 w-4 shrink-0 text-purple-500" />
          <div className="min-w-0">
            <p className="text-sm font-medium">Cân bằng 2 seat</p>
            <p className="text-xs text-muted-foreground">
              {s.overloadedSeatLabel} ↔ {s.underusedSeatLabel}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{s.reason}</p>
          </div>
        </div>
        {!readOnly && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 shrink-0 text-xs"
            onClick={() => console.log("[BLD] Apply rebalance_seat", s)}
          >
            Áp dụng
          </Button>
        )}
      </div>
    </div>
  );
}

function AddSeatCard({ s }: { s: Extract<RebalanceSuggestion, { type: "add_seat" }> }) {
  return (
    <div className="rounded-lg border bg-amber-50 p-3 dark:bg-amber-950/20">
      <div className="flex items-start gap-2">
        <PlusCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-400">
            Đề xuất thêm 1 seat
          </p>
          <p className="text-xs text-muted-foreground">{s.reason}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Chi phí ước tính: ${s.estimatedMonthlyCost}/tháng
          </p>
        </div>
      </div>
    </div>
  );
}

const GROUP_CONFIG = [
  {
    type: "move_member" as const,
    label: "Di chuyển member",
    icon: <ArrowRightLeft className="h-4 w-4 text-blue-500" />,
  },
  {
    type: "rebalance_seat" as const,
    label: "Rebalance seat",
    icon: <Scale className="h-4 w-4 text-purple-500" />,
  },
  {
    type: "add_seat" as const,
    label: "Đề xuất thêm seat",
    icon: <PlusCircle className="h-4 w-4 text-amber-500" />,
  },
];

export function BldActionsPanel({ suggestions, readOnly = false }: Props) {
  if (suggestions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Đề xuất tối ưu</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-2 text-sm text-muted-foreground">
            Không có đề xuất nào — đội seat đang hoạt động ổn định.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          Đề xuất tối ưu
          <Badge variant="secondary">{suggestions.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {GROUP_CONFIG.map(({ type, label, icon }) => {
          const group = suggestions.filter((s) => s.type === type);
          if (group.length === 0) return null;
          return (
            <div key={type}>
              <div className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                {icon}
                <span>{label}</span>
                <Badge variant="outline" className="ml-1 text-xs">
                  {group.length}
                </Badge>
              </div>
              <div className="space-y-2">
                {group.map((s, i) => {
                  if (s.type === "move_member")
                    return <MoveMemberCard key={i} s={s} readOnly={readOnly} />;
                  if (s.type === "rebalance_seat")
                    return <RebalanceSeatCard key={i} s={s} readOnly={readOnly} />;
                  if (s.type === "add_seat")
                    return <AddSeatCard key={i} s={s} />;
                  return null;
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
