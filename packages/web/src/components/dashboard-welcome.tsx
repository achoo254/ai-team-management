import { LayoutDashboard, Plus, Users, Bell } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router";

/** Welcome screen shown when user has no seats yet */
export function DashboardWelcome() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-lg border-dashed">
        <CardContent className="flex flex-col items-center gap-6 py-12 text-center">
          <div className="flex items-center justify-center gap-2">
            <div className="rounded-xl bg-primary/10 p-3">
              <LayoutDashboard className="h-8 w-8 text-primary" />
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold tracking-tight">
              Chào mừng đến với Claude Teams!
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
              Bạn chưa có seat nào. Tạo seat mới để bắt đầu, hoặc chờ được
              thêm vào seat của team khác.
            </p>
          </div>

          <div className="grid w-full max-w-xs gap-3">
            <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3 text-left text-sm">
              <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>Tự tạo seat và quản lý credentials</span>
            </div>
            <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3 text-left text-sm">
              <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>Hoặc được owner khác gán vào seat</span>
            </div>
            <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3 text-left text-sm">
              <Bell className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>Dashboard sẽ hiển thị usage & alerts</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={() => navigate("/seats")}>
              <Plus className="h-4 w-4" />
              Tạo seat mới
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/settings")}>
              Cài đặt tài khoản
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
