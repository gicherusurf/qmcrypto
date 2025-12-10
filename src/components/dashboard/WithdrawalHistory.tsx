import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";

export function WithdrawalHistory() {
  const { profile } = useAuth();

  const { data: withdrawals, isLoading } = useQuery({
    queryKey: ["user-withdrawals", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from("withdrawals")
        .select("*")
        .eq("user_id", profile.id)
        .order("requested_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4" />;
      case "approved":
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case "completed":
        return <CheckCircle className="h-4 w-4" />;
      case "rejected":
        return <XCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "pending":
        return "secondary";
      case "approved":
        return "default";
      case "completed":
        return "default";
      case "rejected":
        return "destructive";
      default:
        return "outline";
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-card/50 backdrop-blur border-border">
        <CardContent className="p-6 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 backdrop-blur border-border">
      <CardHeader>
        <CardTitle className="text-lg">Withdrawal History</CardTitle>
      </CardHeader>
      <CardContent>
        {!withdrawals || withdrawals.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">No withdrawal requests yet</p>
        ) : (
          <div className="space-y-3">
            {withdrawals.map((withdrawal) => (
              <div
                key={withdrawal.id}
                className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border"
              >
                <div className="space-y-1">
                  <p className="font-semibold text-primary">${withdrawal.amount.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(withdrawal.requested_at), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                  <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                    {withdrawal.wallet_address}
                  </p>
                </div>
                <Badge variant={getStatusVariant(withdrawal.status)} className="flex items-center gap-1">
                  {getStatusIcon(withdrawal.status)}
                  {withdrawal.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
