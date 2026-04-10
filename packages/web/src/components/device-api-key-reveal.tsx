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
  deviceId: string;
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

export function DeviceApiKeyReveal({ apiKey, deviceId, webhookUrl }: Props) {
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
        <Label>Device ID</Label>
        <div className="flex gap-2">
          <Input readOnly value={deviceId} className="font-mono text-xs" />
          <Button type="button" variant="outline" size="icon" onClick={() => copy(deviceId, "Device ID")}>
            {copied === "Device ID" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
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

      {/* curl + pre-request script for Postman testing */}
      <div className="space-y-1.5">
        <Label>Postman curl</Label>
        <div className="relative">
          <pre className="rounded-md bg-muted p-3 text-[11px] leading-relaxed text-muted-foreground overflow-auto max-h-[180px] whitespace-pre-wrap break-all">
{curlSnippet(webhookUrl, deviceId)}
          </pre>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="absolute top-2 right-2 h-7 w-7"
            onClick={() => copy(curlSnippet(webhookUrl, deviceId), "curl")}
          >
            {copied === "curl" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Import curl vào Postman, paste script bên dưới vào tab <b>Scripts → Pre-request</b>
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Pre-request Script</Label>
        <div className="relative">
          <pre className="rounded-md bg-muted p-3 text-[11px] leading-relaxed text-muted-foreground overflow-auto max-h-[180px] whitespace-pre-wrap break-all">
{postmanPreRequestScript(apiKey)}
          </pre>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="absolute top-2 right-2 h-7 w-7"
            onClick={() => copy(postmanPreRequestScript(apiKey), "pre-request")}
          >
            {copied === "pre-request" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Postman-importable curl with example body (no bash variables). */
function curlSnippet(url: string, deviceId: string) {
  const body = JSON.stringify({
    event: 'usage_report',
    timestamp: new Date().toISOString(),
    app_version: '0.1.0',
    member_email: 'you@example.com',
    device_info: { device_id: deviceId, device_name: 'test', hostname: 'test' },
    system_info: {
      os_name: 'Windows', os_version: '11', hostname: 'test',
      cpu_name: 'i7', cpu_cores: 8, ram_total_mb: 16384, ram_used_mb: 8192, arch: 'x64',
    },
    data: { profiles: [] },
    session_usage: {
      period: '5h',
      summary: { totalInputTokens: 0, totalOutputTokens: 0, totalCacheRead: 0, totalCacheWrite: 0, sessionCount: 0 },
      sessions: [],
    },
  })

  return `curl -X POST "${url}" \\
  -H "Content-Type: application/json" \\
  -H "X-Device-Id: ${deviceId}" \\
  -H "X-Timestamp: {{timestamp}}" \\
  -H "X-Signature: {{signature}}" \\
  -d '${body}'`
}

/** Postman Pre-request Script — auto-computes X-Timestamp + HMAC X-Signature. */
function postmanPreRequestScript(apiKey: string) {
  return `const timestamp = Date.now().toString();
const body = pm.request.body.raw;
const signature = CryptoJS.HmacSHA256(timestamp + "." + body, "${apiKey}").toString();
pm.variables.set("timestamp", timestamp);
pm.variables.set("signature", signature);`
}
