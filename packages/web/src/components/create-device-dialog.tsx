// 2-step dialog: one-click create → one-time api_key reveal.
// Device name/hostname auto-populated when desktop app first reports via webhook.
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCreateDevice } from "@/hooks/use-devices";
import { DeviceApiKeyReveal } from "@/components/device-api-key-reveal";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateDeviceDialog({ open, onOpenChange }: Props) {
  const [revealKey, setRevealKey] = useState<string | null>(null);
  const createDevice = useCreateDevice();

  const apiBase = import.meta.env.VITE_API_URL || "";
  const webhookUrl = `${apiBase || window.location.origin}/api/webhook/usage-report`;

  const handleCreate = async () => {
    const res = await createDevice.mutateAsync({});
    setRevealKey(res.api_key);
  };

  const handleClose = (next: boolean) => {
    if (!next) setRevealKey(null);
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{revealKey ? "Device đã tạo" : "Thêm Desktop Device"}</DialogTitle>
          <DialogDescription>
            {revealKey
              ? "Copy API key và cấu hình desktop app trước khi đóng."
              : "Tạo API key mới. Thông tin device sẽ tự cập nhật khi desktop app kết nối."}
          </DialogDescription>
        </DialogHeader>

        {revealKey ? (
          <>
            <DeviceApiKeyReveal apiKey={revealKey} webhookUrl={webhookUrl} />
            <DialogFooter>
              <Button onClick={() => handleClose(false)}>Tôi đã copy key</Button>
            </DialogFooter>
          </>
        ) : (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleClose(false)}>
              Huỷ
            </Button>
            <Button onClick={handleCreate} disabled={createDevice.isPending}>
              {createDevice.isPending ? "Đang tạo..." : "Tạo device"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
