import { BotSettingsForm } from "@/components/bot-settings-form";
import { AlertSettingsForm } from "@/components/alert-settings-form";
import { NotificationScheduleForm } from "@/components/notification-schedule-form";
import { WatchedSeatsSummary } from "@/components/watched-seats-summary";
import { WatchEmptyStateBanner } from "@/components/watch-empty-state-banner";
import { useAuth } from "@/hooks/use-auth";

export default function SettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Cài đặt</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Cài đặt cá nhân</p>
      </div>
      <WatchEmptyStateBanner />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BotSettingsForm />
        <AlertSettingsForm />
        <NotificationScheduleForm />
        <WatchedSeatsSummary />
      </div>
    </div>
  );
}
