import { BotSettingsForm } from "@/components/bot-settings-form";
import { AlertSettingsForm } from "@/components/alert-settings-form";
import { NotificationScheduleForm } from "@/components/notification-schedule-form";
import { WatchedSeatsCard } from "@/components/watched-seats-card";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Cài đặt</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Cài đặt cá nhân</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BotSettingsForm />
        <WatchedSeatsCard />
        <AlertSettingsForm />
        <NotificationScheduleForm />
      </div>
    </div>
  );
}
