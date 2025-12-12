import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Loader2, DollarSign, Bitcoin, Wallet, ImageIcon, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

export function AdminAllDeposits() {
  const [search, setSearch] = useState("");

  const { data: investments, isLoading } = useQuery({
    queryKey: ["admin-all-investments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("investments")
        .select(`
          *,
          profiles!investments_user_id_fkey (
            email,
            full_name
          ),
          investment_packages (
            name,
            return_percentage,
            return_period_days
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const stats = {
    total: investments?.length || 0,
    totalAmount: investments?.reduce((sum, inv) => sum + Number(inv.amount), 0) || 0,
    active: investments?.filter(inv => inv.status === "active").length || 0,
    pending: investments?.filter(inv => inv.status === "pending").length || 0,
    rejected: investments?.filter(inv => inv.status === "rejected").length || 0,
  };

  const filteredInvestments = investments?.filter(investment => {
    const profileData = investment.profiles as { email: string | null; full_name: string | null } | null;
    const packageData = investment.investment_packages as { name: string } | null;
    
    return (
      profileData?.email?.toLowerCase().includes(search.toLowerCase()) ||
      profileData?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      packageData?.name?.toLowerCase().includes(search.toLowerCase()) ||
      investment.payment_tx_hash?.toLowerCase().includes(search.toLowerCase())
    );
  });

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "active":
        return <Badge className="bg-success/20 text-success border-success/30">Active</Badge>;
      case "pending":
        return <Badge className="bg-warning/20 text-warning border-warning/30">Pending</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="glass-card">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Total Deposits</p>
            <p className="text-xl font-display font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Total Amount</p>
            <p className="text-xl font-display font-bold text-success">${stats.totalAmount.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Active</p>
            <p className="text-xl font-display font-bold text-success">{stats.active}</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="text-xl font-display font-bold text-warning">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Rejected</p>
            <p className="text-xl font-display font-bold text-destructive">{stats.rejected}</p>
          </CardContent>
        </Card>
      </div>

      {/* All Deposits Table */}
      <Card className="glass-card">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                All Deposits
              </CardTitle>
              <CardDescription>Complete history of all user investments</CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search deposits..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!filteredInvestments || filteredInvestments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No deposits found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Package</TableHead>
                    <TableHead>Amount (USD)</TableHead>
                    <TableHead>Crypto Payment</TableHead>
                    <TableHead>TX Hash</TableHead>
                    <TableHead>Proof</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvestments.map((investment) => {
                    const profileData = investment.profiles as { email: string | null; full_name: string | null } | null;
                    const packageData = investment.investment_packages as { name: string; return_percentage: number | null; return_period_days: number | null } | null;

                    return (
                      <TableRow key={investment.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{profileData?.full_name || "Unknown"}</div>
                            <div className="text-xs text-muted-foreground">{profileData?.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>{packageData?.name || "Unknown"}</TableCell>
                        <TableCell className="font-semibold">${Number(investment.amount).toFixed(2)}</TableCell>
                        <TableCell>
                          {investment.crypto_amount && investment.crypto_currency ? (
                            <div className="flex items-center gap-1">
                              {investment.crypto_currency === "BTC" ? (
                                <Bitcoin className="h-4 w-4 text-orange-500" />
                              ) : (
                                <Wallet className="h-4 w-4 text-green-500" />
                              )}
                              <span className="font-medium text-sm">
                                {investment.crypto_currency === "BTC"
                                  ? Number(investment.crypto_amount).toFixed(8)
                                  : Number(investment.crypto_amount).toFixed(2)}
                              </span>
                              <span className="text-xs text-muted-foreground">{investment.crypto_currency}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-secondary px-2 py-1 rounded max-w-[120px] truncate block">
                            {investment.payment_tx_hash || "N/A"}
                          </code>
                          {investment.payment_tx_hash && (
                            <a
                              href={`https://tronscan.org/#/transaction/${investment.payment_tx_hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                            >
                              <ExternalLink className="h-3 w-3" />
                              View
                            </a>
                          )}
                        </TableCell>
                        <TableCell>
                          {investment.payment_proof_url ? (
                            <a
                              href={investment.payment_proof_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block"
                            >
                              <img
                                src={investment.payment_proof_url}
                                alt="Payment proof"
                                className="w-10 h-10 object-cover rounded border border-border hover:scale-150 transition-transform cursor-zoom-in"
                              />
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-sm flex items-center gap-1">
                              <ImageIcon className="h-4 w-4" />
                              None
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(investment.status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {investment.created_at ? format(new Date(investment.created_at), "MMM d, yyyy") : "N/A"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
