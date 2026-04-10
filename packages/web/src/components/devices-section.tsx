// Devices management section mounted in settings page.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { useDevices } from "@/hooks/use-devices";
import { DevicesTable } from "@/components/devices-table";
import { CreateDeviceDialog } from "@/components/create-device-dialog";

export function DevicesSection() {
  const { data, isLoading, error } = useDevices();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <Card className="col-span-1 lg:col-span-2">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Desktop Devices</CardTitle>
            <CardDescription>
              Quản lý các máy cá nhân gửi telemetry từ Claude Tools desktop app.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Thêm device
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading && <div className="text-sm text-muted-foreground">Đang tải...</div>}
          {error && <div className="text-sm text-destructive">Lỗi: {error.message}</div>}
          {data && <DevicesTable devices={data.devices} />}
        </CardContent>
      </Card>
      <CreateDeviceDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
