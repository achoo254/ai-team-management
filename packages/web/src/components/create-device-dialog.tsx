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
import { XIcon } from "lucide-react";
import { useCreateDevice } from "@/hooks/use-devices";
import { DeviceApiKeyReveal } from "@/components/device-api-key-reveal";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateDeviceDialog({ open, onOpenChange }: Props) {
  const [revealKey, setRevealKey] = useState<string | null>(null);
  const createDevice = useCreateDevice();

  // Webhook URL must be the public origin (not VITE_API_URL which is a dev proxy config)
  const webhookUrl = `${window.location.origin}/api/webhook/usage-report`;

  const [revealDeviceId, setRevealDeviceId] = useState<string | null>(null);

  const handleCreate = async () => {
    const res = await createDevice.mutateAsync({});
    setRevealKey(res.api_key);
    setRevealDeviceId(res.device.device_id);
  };

  const handleClose = (next: boolean) => {
    if (!next) {
      setRevealKey(null);
      setRevealDeviceId(null);
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (next) onOpenChange(next); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" showCloseButton={false}>
        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute top-2 right-2"
          onClick={() => handleClose(false)}
        >
          <XIcon />
          <span className="sr-only">Close</span>
        </Button>
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
            <DeviceApiKeyReveal apiKey={revealKey} deviceId={revealDeviceId!} webhookUrl={webhookUrl} />
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
