import { useEffect, useState, type ChangeEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CredentialPathGuide } from "@/components/credential-path-guide";
import { parseCredentialJson, type ParsedCredential } from "@repo/shared/credential-parser";
import { usePreviewSeatToken, type PreviewTokenResponse, type CreateSeatPayload, type Seat } from "@/hooks/use-seats";
import { SeatRestoreBanner } from "@/components/seat-restore-banner";

export type SeatFormSubmit =
  | { mode: "create"; data: CreateSeatPayload }
  | { mode: "edit"; data: { email: string; label: string; max_users: number; include_in_overview: boolean } };

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (p: SeatFormSubmit) => void;
  loading?: boolean;
  initial?: Seat | null;
}

const PROFILE_DEBOUNCE_MS = 500;

export function SeatFormDialog({ open, onClose, onSubmit, loading, initial }: Props) {
  if (initial) {
    return <EditMode open={open} onClose={onClose} onSubmit={onSubmit} loading={loading} initial={initial} />;
  }
  return <CreateMode open={open} onClose={onClose} onSubmit={onSubmit} loading={loading} />;
}

// ---------------- Edit mode (unchanged behavior) ----------------

function EditMode({ open, onClose, onSubmit, loading, initial }: Props & { initial: Seat }) {
  const [form, setForm] = useState({
    email: initial.email,
    label: initial.label,
    max_users: initial.max_users,
    include_in_overview: initial.include_in_overview ?? false,
  });
  useEffect(() => {
    setForm({
      email: initial.email,
      label: initial.label,
      max_users: initial.max_users,
      include_in_overview: initial.include_in_overview ?? false,
    });
  }, [initial, open]);

  const set = (k: keyof typeof form, v: string | number | boolean) =>
    setForm(f => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Sửa Seat</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Email</Label>
            <Input value={form.email} onChange={e => set("email", e.target.value)} placeholder="claude@example.com" />
          </div>
          <div className="grid gap-1.5">
            <Label>Label</Label>
            <Input value={form.label} onChange={e => set("label", e.target.value)} placeholder="Seat A" />
          </div>
          <div className="grid gap-1.5">
            <Label>Số user tối đa</Label>
            <Input type="number" min={1} max={10} value={form.max_users}
              onChange={e => set("max_users", Number(e.target.value))} />
          </div>
          {/* include_in_overview toggle — visible to all managers (admin or owner via requireSeatOwnerOrAdmin) */}
          <div className="flex items-start gap-3 rounded-md border p-3">
            <input
              id="edit-include-in-overview"
              type="checkbox"
              className="mt-0.5 h-4 w-4 cursor-pointer accent-primary"
              checked={form.include_in_overview}
              onChange={e => set("include_in_overview", e.target.checked)}
            />
            <div className="grid gap-0.5">
              <label htmlFor="edit-include-in-overview" className="text-sm font-medium cursor-pointer">
                Tính vào thống kê tổng quan
              </label>
              <p className="text-xs text-muted-foreground">
                Dữ liệu seat sẽ được tính vào mục Tổng quan (mức tận dụng, lãng phí) và báo cáo usage tự động
              </p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Huỷ</Button>
          <Button
            onClick={() => onSubmit({ mode: "edit", data: form })}
            disabled={loading || !form.email || !form.label}>
            {loading ? "Đang lưu..." : "Lưu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Create mode (token-first) ----------------

function CreateMode({ open, onClose, onSubmit, loading }: Props) {
  const [rawJson, setRawJson] = useState("");
  const [parsed, setParsed] = useState<ParsedCredential | null>(null);
  const [parseInvalid, setParseInvalid] = useState(false);
  const [profile, setProfile] = useState<PreviewTokenResponse | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualEmail, setManualEmail] = useState("");
  const [labelOverride, setLabelOverride] = useState("");
  const [maxUsers, setMaxUsers] = useState(2);
  const [includeInOverview, setIncludeInOverview] = useState(true);
  const [restorableSeat, setRestorableSeat] = useState<PreviewTokenResponse['restorable_seat']>(null);

  const preview = usePreviewSeatToken();

  // Reset on open/close
  useEffect(() => {
    if (!open) {
      setRawJson(""); setParsed(null); setParseInvalid(false);
      setProfile(null); setProfileError(null);
      setManualMode(false); setManualEmail(""); setLabelOverride(""); setMaxUsers(2);
      setIncludeInOverview(true); setRestorableSeat(null);
    }
  }, [open]);

  // Parse JSON on input change
  useEffect(() => {
    if (!rawJson.trim()) { setParsed(null); setParseInvalid(false); return; }
    const p = parseCredentialJson(rawJson);
    setParsed(p);
    setParseInvalid(!p);
  }, [rawJson]);

  // Debounced profile preview when parse valid + not in manual mode
  useEffect(() => {
    if (!parsed || manualMode) { setProfile(null); setProfileError(null); return; }
    setProfileError(null);
    const t = setTimeout(() => {
      preview.mutate(rawJson.trim(), {
        onSuccess: (data) => { setProfile(data); setProfileError(null); setRestorableSeat(data.restorable_seat ?? null); },
        onError: (e: Error) => { setProfile(null); setProfileError(e.message || "Không lấy được profile"); setRestorableSeat(null); },
      });
    }, PROFILE_DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed, manualMode, rawJson]);

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setRawJson(ev.target?.result as string);
    reader.readAsText(file);
  };

  const duplicate = !!profile?.duplicate_seat_id;
  const expiry = parsed?.expiresAt ? formatExpiry(parsed.expiresAt) : null;
  const effectiveEmail = manualMode ? manualEmail : profile?.account.email;
  const effectiveLabelDefault = manualMode ? labelOverride : profile?.account.full_name ?? "";
  const canSubmit =
    parsed && !duplicate && !restorableSeat && !preview.isPending && !loading && maxUsers >= 1 && (
      manualMode ? !!manualEmail.trim() && !!labelOverride.trim() : !!profile
    );

  const handleSubmit = () => {
    if (!parsed) return;
    const payload: CreateSeatPayload = {
      credential_json: rawJson.trim(),
      max_users: maxUsers,
      include_in_overview: includeInOverview,
      ...(labelOverride ? { label: labelOverride } : {}),
      ...(manualMode ? { manual_mode: true, email: manualEmail } : {}),
    };
    onSubmit({ mode: "create", data: payload });
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Thêm Seat</DialogTitle></DialogHeader>

        <div className="space-y-4">
          <CredentialPathGuide />

          <Tabs defaultValue="paste">
            <TabsList>
              <TabsTrigger value="paste">Paste JSON</TabsTrigger>
              <TabsTrigger value="upload">Upload File</TabsTrigger>
            </TabsList>
            <TabsContent value="paste" className="mt-2">
              <Label htmlFor="create-cred-json" className="sr-only">Credential JSON</Label>
              <textarea
                id="create-cred-json"
                className="w-full rounded-md border bg-transparent px-3 py-2 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
                rows={6}
                placeholder='Paste credential JSON (e.g. {"claudeAiOauth":{...}})'
                value={rawJson}
                onChange={e => setRawJson(e.target.value)}
              />
            </TabsContent>
            <TabsContent value="upload" className="mt-2">
              <input type="file" accept=".json" onChange={handleFileUpload}
                className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90" />
            </TabsContent>
          </Tabs>

          {/* Parse feedback */}
          {rawJson.trim() && parseInvalid && (
            <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/5 p-2 text-sm text-destructive">
              JSON không hợp lệ hoặc thiếu access_token
            </div>
          )}
          {parsed && (
            <div className="rounded-md border p-3 text-sm space-y-1">
              <div className="font-medium text-green-600 dark:text-green-400">Credential hợp lệ</div>
              <div><span className="text-muted-foreground">Access token:</span> <code className="text-xs">...{parsed.accessToken.slice(-4)}</code></div>
              {expiry && <div><span className="text-muted-foreground">Hết hạn:</span> <Badge variant={expiry.variant}>{expiry.text}</Badge></div>}
            </div>
          )}

          {/* Profile preview */}
          {parsed && !manualMode && preview.isPending && (
            <div className="text-sm text-muted-foreground">Đang lấy profile...</div>
          )}
          {parsed && !manualMode && profile && (
            <div className="rounded-md border p-3 text-sm space-y-1">
              <div className="font-medium text-green-600 dark:text-green-400">Profile</div>
              <div>✓ Email: <code className="text-xs">{profile.account.email}</code></div>
              <div>✓ Org: {profile.organization.name}</div>
              <div>✓ Tier: <code className="text-xs">{profile.organization.rate_limit_tier}</code></div>
              {duplicate && (
                <div role="alert" className="mt-2 rounded border border-destructive/50 bg-destructive/5 p-2 text-destructive">
                  ⚠ Seat với email <code>{profile.account.email}</code> đã tồn tại. Dùng chức năng Update Token để cập nhật.
                </div>
              )}
            </div>
          )}
          {parsed && !manualMode && profileError && (
            <div role="alert" className="rounded-md border border-amber-500/50 bg-amber-500/5 p-3 text-sm space-y-2">
              <div>⚠ Không fetch được profile: {profileError}</div>
              <Button type="button" variant="outline" size="sm" onClick={() => setManualMode(true)}>
                Chuyển sang chế độ nhập thủ công
              </Button>
            </div>
          )}

          {/* Restore banner — shown when soft-deleted seat matches */}
          {restorableSeat && !duplicate && (
            <SeatRestoreBanner
              seat={restorableSeat}
              loading={loading}
              onRestore={() => {
                if (!parsed) return;
                onSubmit({
                  mode: "create",
                  data: {
                    credential_json: rawJson.trim(),
                    max_users: maxUsers,
                    include_in_overview: includeInOverview,
                    ...(labelOverride ? { label: labelOverride } : {}),
                    restore_seat_id: restorableSeat._id,
                  },
                });
              }}
              onCreateNew={() => {
                if (!parsed) return;
                onSubmit({
                  mode: "create",
                  data: {
                    credential_json: rawJson.trim(),
                    max_users: maxUsers,
                    include_in_overview: includeInOverview,
                    ...(labelOverride ? { label: labelOverride } : {}),
                    force_new: true,
                  },
                });
              }}
            />
          )}

          {/* Manual mode fields */}
          {manualMode && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Chế độ thủ công</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => setManualMode(false)}>
                  Thử lại auto
                </Button>
              </div>
              <div className="grid gap-1.5">
                <Label>Email *</Label>
                <Input value={manualEmail} onChange={e => setManualEmail(e.target.value)} placeholder="claude@example.com" />
              </div>
            </div>
          )}

          {/* Label + max_users */}
          {parsed && (
            <div className="grid gap-3 pt-1">
              <div className="grid gap-1.5">
                <Label>Label</Label>
                <Input
                  value={labelOverride || effectiveLabelDefault}
                  onChange={e => setLabelOverride(e.target.value)}
                  placeholder={manualMode ? "Nhập label" : "Auto từ profile"}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Số user tối đa</Label>
                <Input type="number" min={1} max={10} value={maxUsers}
                  onChange={e => setMaxUsers(Number(e.target.value))} />
              </div>
              {effectiveEmail && (
                <div className="text-xs text-muted-foreground">
                  Seat sẽ được tạo với email: <code>{effectiveEmail}</code>
                </div>
              )}
              <div className="flex items-start gap-3 rounded-md border p-3">
                <input
                  id="create-include-in-overview"
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 cursor-pointer accent-primary"
                  checked={includeInOverview}
                  onChange={e => setIncludeInOverview(e.target.checked)}
                />
                <div className="grid gap-0.5">
                  <label htmlFor="create-include-in-overview" className="text-sm font-medium cursor-pointer">
                    Đưa vào báo cáo tổng quan
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Seat này sẽ xuất hiện trong tab Tổng quan của Dashboard
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Huỷ</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {loading ? "Đang lưu..." : "Tạo Seat"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Format token expiry as friendly countdown badge */
function formatExpiry(expiresAt: number): { text: string; variant: "default" | "secondary" | "destructive" } {
  const ms = expiresAt - Date.now();
  if (ms <= 0) return { text: "Đã hết hạn", variant: "destructive" };
  const hours = Math.floor(ms / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  if (hours > 0) return { text: `Hết hạn sau ${hours}h ${mins}m`, variant: "default" };
  return { text: `Hết hạn sau ${mins} phút`, variant: "destructive" };
}
