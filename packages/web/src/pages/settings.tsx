import { BotSettingsForm } from "@/components/bot-settings-form";
import { NotificationScheduleForm } from "@/components/notification-schedule-form";

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold">Cài đặt</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Cài đặt cá nhân</p>
      </div>
      <BotSettingsForm />
      <NotificationScheduleForm />
    </div>
  );
}
