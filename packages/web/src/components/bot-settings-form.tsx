import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Trash2 } from "lucide-react";
import { useUserSettings, useUpdateUserSettings, useTestBot } from "@/hooks/use-user-settings";

export function BotSettingsForm() {
  const { data: settings, isLoading } = useUserSettings();
  const updateMutation = useUpdateUserSettings();
  const testMutation = useTestBot();

  const [token, setToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [dirty, setDirty] = useState(false);

  // Sync chat ID from server when loaded
  const serverChatId = settings?.telegram_chat_id ?? "";
  if (!dirty && chatId !== serverChatId && settings) {
    setChatId(serverChatId);
  }

  function handleSave() {
    const body: { telegram_bot_token?: string | null; telegram_chat_id?: string | null } = {};
    if (token) body.telegram_bot_token = token;
    body.telegram_chat_id = chatId || null;
    updateMutation.mutate(body, {
      onSuccess: () => { setToken(""); setDirty(false); },
    });
  }

  function handleClear() {
    updateMutation.mutate(
      { telegram_bot_token: "", telegram_chat_id: null },
      { onSuccess: () => { setToken(""); setChatId(""); setDirty(false); } },
    );
  }

  if (isLoading) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">Telegram Bot cá nhân</CardTitle>
          {settings?.has_telegram_bot && (
            <Badge variant="default" className="text-[10px]">Đã cấu hình</Badge>
          )}
        </div>
        <CardDescription className="text-xs">
          Nhận thông báo cá nhân qua bot riêng. Hệ thống vẫn gửi vào nhóm chung.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="text-xs">Bot Token</Label>
          <Input
            type="password"
            placeholder={settings?.has_telegram_bot ? "••••••••••" : "Paste bot token từ @BotFather"}
            value={token}
            onChange={(e) => { setToken(e.target.value); setDirty(true); }}
          />
        </div>
        <div>
          <Label className="text-xs">Chat ID</Label>
          <Input
            placeholder="Số chat ID cá nhân"
            value={chatId}
            onChange={(e) => { setChatId(e.target.value); setDirty(true); }}
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending || (!token && !dirty)}>
            {updateMutation.isPending && <Loader2 size={14} className="animate-spin mr-1" />}
            Lưu
          </Button>
          {settings?.has_telegram_bot && (
            <>
              <Button size="sm" variant="outline" onClick={() => testMutation.mutate()}
                disabled={testMutation.isPending}>
                {testMutation.isPending
                  ? <Loader2 size={14} className="animate-spin mr-1" />
                  : <Send size={14} className="mr-1" />}
                Test
              </Button>
              <Button size="sm" variant="ghost" className="text-red-500" onClick={handleClear}
                disabled={updateMutation.isPending}>
                <Trash2 size={14} className="mr-1" />
                Xoá cấu hình
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
