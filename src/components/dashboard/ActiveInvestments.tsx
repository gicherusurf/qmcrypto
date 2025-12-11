import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Clock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

export function ActiveInvestments() {
  const { profile } = useAuth();

  const { data: investments, isLoading } = useQuery({
    queryKey: ["user-investments", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      
      const { data, error } = await supabase
        .from("investments")
        .select(`
          *,
          investment_packages (
            name,
            return_percentage,
            return_period_days
          )
        `)
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!investments?.length) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Active Investments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">
            No active investments yet. Start your first investment to begin earning!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Active Investments ({investments.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {investments.map((investment) => {
            const statusVariant = 
              investment.status === "active" ? "default" : 
              investment.status === "pending" ? "secondary" : 
              investment.status === "rejected" ? "destructive" : "outline";

            return (
              <div
                key={investment.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-secondary/30 rounded-lg border border-border/50"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-display font-bold text-lg">
                      ${Number(investment.amount).toFixed(2)}
                    </span>
                    <Badge variant={statusVariant}>
                      {investment.status === "pending" ? "Awaiting Verification" : investment.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {investment.investment_packages?.name} • {investment.investment_packages?.return_percentage}% returns
                  </div>
                  {investment.payment_tx_hash && (
                    <div className="text-xs text-muted-foreground mt-1">
                      TX: <code className="bg-secondary px-1 rounded">{investment.payment_tx_hash.slice(0, 20)}...</code>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-2 mt-3 sm:mt-0">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {investment.status === "pending" 
                      ? "Payment being verified"
                      : investment.status === "rejected"
                      ? "Payment rejected"
                      : investment.next_earning_at
                      ? `Next earning ${formatDistanceToNow(new Date(investment.next_earning_at), { addSuffix: true })}`
                      : "Processing"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
