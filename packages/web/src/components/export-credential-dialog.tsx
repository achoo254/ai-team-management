import { useState, useMemo } from "react";
import { Download, FolderOpen, AlertTriangle, Copy, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type OS = "windows" | "linux" | "macos";

function detectOS(): OS {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("mac")) return "macos";
  if (ua.includes("linux")) return "linux";
  return "windows";
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs shrink-0" onClick={handleCopy}>
      {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
      {copied ? "Đã copy" : "Copy"}
    </Button>
  );
}

const CREDENTIAL_PATHS: Record<OS, { path: string; hint: string }> = {
  windows: {
    path: "%USERPROFILE%\\.claude\\.credentials.json",
    hint: "Paste vào File Explorer hoặc CMD/PowerShell",
  },
  linux: {
    path: "~/.claude/.credentials.json",
    hint: "~ = /home/<tên bạn>",
  },
  macos: {
    path: "~/.claude/.credentials.json",
    hint: "Hoặc tìm trong Keychain Access → search \"claude\"",
  },
};

const OS_LABELS: Record<OS, string> = {
  windows: "Windows",
  linux: "Linux",
  macos: "macOS",
};

interface Props {
  open: boolean;
  seatLabel: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ExportCredentialDialog({ open, seatLabel, loading, onClose, onConfirm }: Props) {
  const currentOS = useMemo(() => detectOS(), []);
  const cred = CREDENTIAL_PATHS[currentOS];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Credential
          </DialogTitle>
          <DialogDescription>
            Export credential của seat <strong>{seatLabel}</strong> dưới dạng file JSON.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {/* Hướng dẫn sử dụng */}
          <div className="rounded-md border p-3 space-y-2">
            <div className="flex items-center gap-1.5 font-medium">
              <FolderOpen className="h-4 w-4" />
              Hướng dẫn sử dụng file export
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
              <li>File tải về có dạng <code className="text-xs">credential-{seatLabel}-YYYY-MM-DD.json</code></li>
              <li>
                Sao chép file vào thư mục credential của Claude:
                <div className="mt-1 ml-4">
                  {([currentOS, ...(['windows', 'linux', 'macos'] as OS[]).filter(o => o !== currentOS)] as OS[]).map((os) => (
                    <details key={os} open={os === currentOS}>
                      <summary className="cursor-pointer select-none text-xs font-medium hover:text-foreground/80">
                        {OS_LABELS[os]}
                        {os === currentOS && <span className="ml-1 text-[10px] font-normal text-muted-foreground">(hiện tại)</span>}
                      </summary>
                      <div className="flex items-center gap-2 rounded bg-muted/50 px-2 py-1 mt-1 mb-1">
                        <code className="text-xs flex-1 break-all">{CREDENTIAL_PATHS[os].path}</code>
                        <CopyButton text={CREDENTIAL_PATHS[os].path} />
                      </div>
                      <p className="text-[10px] text-muted-foreground/70">{CREDENTIAL_PATHS[os].hint}</p>
                    </details>
                  ))}
                </div>
              </li>
              <li>Đổi tên file thành <code className="text-xs">.credentials.json</code> (hoặc override file cũ)</li>
            </ol>
          </div>

          {/* Lưu ý backup */}
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 space-y-1">
            <div className="flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              Lưu ý quan trọng
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-muted-foreground text-xs">
              <li><strong>Backup file cũ</strong> trước khi override — đổi tên thành <code>.credentials.json.bak</code> để có thể khôi phục</li>
              <li>File credential chứa thông tin nhạy cảm — <strong>không chia sẻ</strong> cho người khác</li>
              <li>Sau khi sao chép, <strong>khởi động lại Claude</strong> để nhận credential mới</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Huỷ
          </Button>
          <Button onClick={onConfirm} disabled={loading} className="gap-1.5">
            <Download className="h-4 w-4" />
            {loading ? "Đang export..." : "Xác nhận Export"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
