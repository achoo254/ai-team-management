// One-time reveal of desktop API key + setup guide.
// Key is held in React state only — never persisted to localStorage/console.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Check, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface Props {
  apiKey: string;
  webhookUrl: string;
}

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
      toast.success(`Đã copy ${label}`);
    } catch {
      toast.error("Copy failed");
    }
  };
  return { copied, copy };
}

export function DeviceApiKeyReveal({ apiKey, webhookUrl }: Props) {
  const { copied, copy } = useCopy();

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
        <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-destructive">Lưu API key ngay!</p>
          <p className="text-destructive/90">
            Key này chỉ hiển thị <b>một lần duy nhất</b>. Sau khi đóng dialog bạn sẽ không xem lại được. Nếu mất, phải tạo device mới.
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>API Key</Label>
        <div className="flex gap-2">
          <Input readOnly value={apiKey} className="font-mono text-xs" />
          <Button type="button" variant="outline" size="icon" onClick={() => copy(apiKey, "API key")}>
            {copied === "API key" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Webhook URL</Label>
        <div className="flex gap-2">
          <Input readOnly value={webhookUrl} className="font-mono text-xs" />
          <Button type="button" variant="outline" size="icon" onClick={() => copy(webhookUrl, "Webhook URL")}>
            {copied === "Webhook URL" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
        Paste API key và Webhook URL vào Claude Tools desktop app. Thông tin device sẽ tự cập nhật khi app kết nối.
      </div>
    </div>
  );
}
