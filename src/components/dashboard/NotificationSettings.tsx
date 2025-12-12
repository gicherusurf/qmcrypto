import { Bell, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePushNotifications } from '@/hooks/use-push-notifications';

export function NotificationSettings() {
  const { isSupported, isSubscribed, isLoading, subscribe, unsubscribe } = usePushNotifications();

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="h-5 w-5" />
            Push Notifications
          </CardTitle>
          <CardDescription>
            Push notifications are not supported in your browser.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Push Notifications
        </CardTitle>
        <CardDescription>
          Get notified about new earnings, withdrawal status, and investment updates.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          onClick={isSubscribed ? unsubscribe : subscribe}
          disabled={isLoading}
          variant={isSubscribed ? "outline" : "default"}
          className="w-full sm:w-auto"
        >
          {isLoading ? (
            "Processing..."
          ) : isSubscribed ? (
            <>
              <BellOff className="mr-2 h-4 w-4" />
              Disable Notifications
            </>
          ) : (
            <>
              <Bell className="mr-2 h-4 w-4" />
              Enable Notifications
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
