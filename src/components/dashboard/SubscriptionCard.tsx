import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, RefreshCw } from "lucide-react";
import { useSubscription, useRenewSubscription, useSetAutoRenew } from "@/hooks/use-subscription";
import { format } from "date-fns";

export function SubscriptionCard() {
  const { data: sub, isLoading } = useSubscription();
  const renew = useRenewSubscription();
  const setAutoRenew = useSetAutoRenew();

  if (isLoading || !sub) return null;

  const isExpired = sub.status === "expired";

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-primary" /> Subscription
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Badge variant={isExpired ? "outline" : "default"} className={isExpired ? "text-destructive border-destructive/40" : ""}>
            {isExpired ? "Expired — signals paused" : "Active"}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {isExpired ? "Renew to unlock signals" : `Next billing: ${format(new Date(sub.current_period_end), "MMM d, yyyy")}`}
          </span>
        </div>

        <p className="text-xs text-muted-foreground">
          $15/30 days, deducted from your available (withdrawable) balance only — your deposited trading capital is never touched.
        </p>

        <div className="flex items-center justify-between">
          <span className="text-sm">Auto-renew</span>
          <Switch
            checked={sub.auto_renew}
            onCheckedChange={(v) => setAutoRenew.mutate(v)}
            disabled={setAutoRenew.isPending}
          />
        </div>

        {isExpired && (
          <Button
            onClick={() => renew.mutate()}
            disabled={renew.isPending || sub.withdrawable_balance < 15}
            variant="hero"
            className="w-full"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            {renew.isPending ? "Renewing..." : "Renew Subscription ($15)"}
          </Button>
        )}
        {isExpired && sub.withdrawable_balance < 15 && (
          <p className="text-xs text-destructive">
            Available balance (${sub.withdrawable_balance.toFixed(2)}) is below $15. Earn more profit or commissions to renew.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
