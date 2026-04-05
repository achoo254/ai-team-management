import { LayoutDashboard, UserPlus, Bell } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router";

/** Welcome screen shown when non-admin user has no seats assigned */
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
              Bạn chưa được gán vào seat nào. Liên hệ quản trị viên để được
              thêm vào team và bắt đầu sử dụng.
            </p>
          </div>

          <div className="grid w-full max-w-xs gap-3">
            <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3 text-left text-sm">
              <UserPlus className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>Admin gán bạn vào một seat</span>
            </div>
            <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3 text-left text-sm">
              <Bell className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>Dashboard sẽ hiển thị usage & alerts</span>
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={() => navigate("/settings")}>
            Cài đặt tài khoản
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
