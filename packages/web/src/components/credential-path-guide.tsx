import { useState, useMemo } from 'react'
import { Copy, Check, FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'

type OS = 'windows' | 'linux' | 'macos'

/** Detect user OS from userAgent */
function detectOS(): OS {
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('mac')) return 'macos'
  if (ua.includes('linux')) return 'linux'
  return 'windows'
}

const OS_LABELS: Record<OS, string> = {
  windows: 'Windows',
  linux: 'Linux',
  macos: 'macOS (Keychain)',
}

function CopyPathButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(path)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={handleCopy}>
      {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
      {copied ? 'Đã copy' : 'Copy'}
    </Button>
  )
}

/** OS-specific credential path instructions */
const OS_CONTENT: Record<OS, (username: string) => React.ReactNode> = {
  windows: (username) => {
    const path = `C:\\Users\\${username}\\.claude\\.credentials.json`
    return (
      <div className="space-y-1">
        <p className="text-muted-foreground">Copy file tại:</p>
        <div className="flex items-center gap-2 rounded bg-muted/50 px-2 py-1">
          <code className="text-xs flex-1 break-all">{path}</code>
          <CopyPathButton path={path} />
        </div>
      </div>
    )
  },
  linux: () => {
    const path = '~/.claude/.credentials.json'
    return (
      <div className="space-y-1">
        <p className="text-muted-foreground">Copy file tại:</p>
        <div className="flex items-center gap-2 rounded bg-muted/50 px-2 py-1">
          <code className="text-xs flex-1">{path}</code>
          <CopyPathButton path={path} />
        </div>
      </div>
    )
  },
  macos: () => (
    <ol className="list-decimal list-inside space-y-0.5 text-muted-foreground">
      <li>Mở <strong>Keychain Access</strong> (Spotlight → "Keychain")</li>
      <li>Tìm kiếm "<code className="text-xs">claude</code>"</li>
      <li>Double-click entry → chọn <strong>Show password</strong></li>
      <li>Nhập password máy → copy giá trị</li>
    </ol>
  ),
}

/** Collapsible guide showing where to find Claude credential files per OS */
export function CredentialPathGuide() {
  const currentOS = useMemo(() => detectOS(), [])
  // Best-effort username for Windows path display
  const username = useMemo(() => {
    const ua = navigator.userAgent
    // Cannot reliably get username from browser — use placeholder
    return navigator.platform?.includes('Win') ? (window as any).__USERNAME__ || 'you' : 'you'
  }, [])

  const osOrder: OS[] = useMemo(() => {
    // Current OS first, then the rest
    const others = (['windows', 'linux', 'macos'] as OS[]).filter((o) => o !== currentOS)
    return [currentOS, ...others]
  }, [currentOS])

  return (
    <div className="rounded-md border p-3 text-sm space-y-1">
      <div className="flex items-center gap-1.5 font-medium mb-2">
        <FolderOpen className="h-4 w-4" />
        Lấy credential từ đâu?
      </div>
      {osOrder.map((os) => (
        <details key={os} open={os === currentOS}>
          <summary className="cursor-pointer select-none text-sm font-medium hover:text-foreground/80">
            {OS_LABELS[os]}
            {os === currentOS && (
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">(OS hiện tại)</span>
            )}
          </summary>
          <div className="pl-4 pt-1.5 pb-1 text-sm">
            {OS_CONTENT[os](username)}
          </div>
        </details>
      ))}
      <p className="text-xs text-muted-foreground pt-1">
        Paste nội dung file JSON hoặc upload trực tiếp bên dưới.
      </p>
    </div>
  )
}
