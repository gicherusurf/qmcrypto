import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, BellOff } from "lucide-react";
import { usePushNotifications } from "@/hooks/use-push-notifications";

export function NotificationSettings() {
  const { isSubscribed, isLoading, subscribe, unsubscribe, isSupported } = usePushNotifications();

  if (!isSupported) return null;

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          Push Notifications
        </CardTitle>
        <CardDescription>
          Get notified about new trading signals, deposits, and withdrawal status.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isSubscribed ? (
          <Button variant="outline" onClick={unsubscribe} disabled={isLoading}>
            <BellOff className="h-4 w-4 mr-2" /> Disable Notifications
          </Button>
        ) : (
          <Button onClick={subscribe} disabled={isLoading}>
            <Bell className="h-4 w-4 mr-2" /> Enable Notifications
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
