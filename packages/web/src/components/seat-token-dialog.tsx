import { useState, useEffect, type ChangeEvent } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useSetSeatToken, useRemoveSeatToken } from '@/hooks/use-usage-snapshots'
import { CredentialPathGuide } from '@/components/credential-path-guide'
import { parseCredentialJson, type ParsedCredential } from '@repo/shared/credential-parser'
import type { Seat } from '@repo/shared'

interface Props {
  seat: Seat | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Format expiry as relative countdown */
function formatExpiry(expiresAt: string | number | null): { text: string; variant: 'default' | 'secondary' | 'destructive' } {
  if (!expiresAt) return { text: 'Không có thông tin hết hạn', variant: 'secondary' }
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return { text: 'Đã hết hạn', variant: 'destructive' }
  const hours = Math.floor(ms / 3_600_000)
  const mins = Math.floor((ms % 3_600_000) / 60_000)
  if (hours > 0) return { text: `Hết hạn sau ${hours}h ${mins}m`, variant: 'default' }
  return { text: `Hết hạn sau ${mins} phút`, variant: 'destructive' }
}

/** Mask token for display — show only last 4 chars */
function maskToken(token: string): string {
  return token.length > 8 ? '...' + token.slice(-4) : '****'
}

export function SeatTokenDialog({ seat, open, onOpenChange }: Props) {
  const [rawJson, setRawJson] = useState('')
  const [parsed, setParsed] = useState<ParsedCredential | null>(null)
  const setMutation = useSetSeatToken()
  const removeMutation = useRemoveSeatToken()

  // Reset state when switching seat
  useEffect(() => {
    setRawJson('')
    setParsed(null)
  }, [seat?._id])

  // Re-parse when raw input changes
  useEffect(() => {
    setParsed(rawJson.trim() ? parseCredentialJson(rawJson) : null)
  }, [rawJson])

  if (!seat) return null

  const handleSave = () => {
    if (!rawJson.trim() || !parsed) return
    setMutation.mutate(
      { seatId: seat._id, credential_json: rawJson.trim() },
      { onSuccess: () => { setRawJson(''); setParsed(null); onOpenChange(false) } },
    )
  }

  const handleRemove = () => {
    removeMutation.mutate(seat._id, {
      onSuccess: () => { setRawJson(''); setParsed(null); onOpenChange(false) },
    })
  }

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setRawJson(ev.target?.result as string)
    reader.readAsText(file)
  }

  const isPending = setMutation.isPending || removeMutation.isPending
  const expiry = seat.oauth_credential?.expires_at
    ? formatExpiry(seat.oauth_credential.expires_at)
    : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Credential — {seat.label}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status badges */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={seat.has_token ? 'default' : 'secondary'}>
              {seat.has_token ? 'Has token' : 'No token'}
            </Badge>
            {seat.has_token && (
              <Badge variant={seat.token_active ? 'default' : 'destructive'}>
                {seat.token_active ? 'Active' : 'Inactive'}
              </Badge>
            )}
            {expiry && <Badge variant={expiry.variant}>{expiry.text}</Badge>}
            {seat.last_refreshed_at && (
              <span className="text-xs text-muted-foreground">
                Refreshed: {new Date(seat.last_refreshed_at).toLocaleString('vi-VN')}
              </span>
            )}
          </div>

          {/* Credential metadata (from API) */}
          {seat.oauth_credential && (
            <div className="rounded-md border p-3 space-y-1.5 text-sm">
              {seat.oauth_credential.scopes.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  <span className="text-muted-foreground">Scopes:</span>
                  {seat.oauth_credential.scopes.map((s) => (
                    <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                  ))}
                </div>
              )}
              {seat.oauth_credential.subscription_type && (
                <div><span className="text-muted-foreground">Subscription:</span> {seat.oauth_credential.subscription_type}</div>
              )}
              {seat.oauth_credential.rate_limit_tier && (
                <div><span className="text-muted-foreground">Rate limit:</span> {seat.oauth_credential.rate_limit_tier}</div>
              )}
            </div>
          )}

          {/* Error display */}
          {seat.last_fetch_error && (
            <p className="text-sm text-destructive">Lỗi: {seat.last_fetch_error}</p>
          )}

          {/* Credential path guide */}
          <CredentialPathGuide />

          {/* Input tabs */}
          <Tabs defaultValue="paste">
            <TabsList>
              <TabsTrigger value="paste">Paste JSON</TabsTrigger>
              <TabsTrigger value="upload">Upload File</TabsTrigger>
            </TabsList>

            <TabsContent value="paste" className="mt-2">
              <Label htmlFor="cred-json" className="sr-only">Credential JSON</Label>
              <textarea
                id="cred-json"
                className="w-full rounded-md border bg-transparent px-3 py-2 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
                rows={6}
                placeholder='Paste credential JSON (e.g. {"claudeAiOauth":{...}})'
                value={rawJson}
                onChange={(e) => setRawJson(e.target.value)}
              />
            </TabsContent>

            <TabsContent value="upload" className="mt-2">
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
              />
            </TabsContent>
          </Tabs>

          {/* Parse preview */}
          {rawJson.trim() && (
            <div className="rounded-md border p-3 space-y-1 text-sm">
              {parsed ? (
                <>
                  <div className="font-medium text-green-600 dark:text-green-400 mb-1">Preview</div>
                  <div><span className="text-muted-foreground">Access token:</span> <code className="text-xs">{maskToken(parsed.accessToken)}</code></div>
                  <div><span className="text-muted-foreground">Refresh token:</span> {parsed.refreshToken ? 'present' : 'absent'}</div>
                  {parsed.expiresAt && (
                    <div><span className="text-muted-foreground">Expires:</span> {new Date(parsed.expiresAt).toLocaleString('vi-VN')} ({formatExpiry(parsed.expiresAt).text})</div>
                  )}
                  {parsed.scopes.length > 0 && (
                    <div><span className="text-muted-foreground">Scopes:</span> {parsed.scopes.length}</div>
                  )}
                  {parsed.subscriptionType && (
                    <div><span className="text-muted-foreground">Subscription:</span> {parsed.subscriptionType}</div>
                  )}
                </>
              ) : (
                <div className="text-destructive">JSON không hợp lệ hoặc thiếu access_token</div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {seat.has_token && (
            <Button variant="destructive" onClick={handleRemove} disabled={isPending}>
              Xoá Token
            </Button>
          )}
          <Button onClick={handleSave} disabled={isPending || !parsed}>
            {isPending ? 'Đang lưu...' : 'Lưu'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
