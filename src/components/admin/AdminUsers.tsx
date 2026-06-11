import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Loader2, Users, DollarSign, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

export function AdminUsers() {
  const [search, setSearch] = useState("");

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      return profiles?.map((p) => ({
        ...p,
        isAdmin: roles?.some((r) => r.user_id === p.user_id && r.role === "admin") || false,
      })) || [];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const { count } = await supabase.from("profiles").select("*", { count: "exact", head: true });
      const { data: deposits } = await supabase.from("deposits").select("amount_usd").eq("status", "approved");
      const totalDeposited = deposits?.reduce((sum, d) => sum + Number(d.amount_usd), 0) || 0;
      return { totalUsers: count || 0, totalDeposited };
    },
  });

  const filtered = users?.filter((u) =>
    u.email?.toLowerCase().includes(search.toLowerCase()) || u.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="glass-card"><CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-primary/10"><Users className="h-6 w-6 text-primary" /></div>
            <div><p className="text-sm text-muted-foreground">Total Users</p><p className="text-2xl font-display font-bold">{stats?.totalUsers || 0}</p></div>
          </div>
        </CardContent></Card>
        <Card className="glass-card"><CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-success/10"><DollarSign className="h-6 w-6 text-success" /></div>
            <div><p className="text-sm text-muted-foreground">Total Deposited</p><p className="text-2xl font-display font-bold text-success">${stats?.totalDeposited?.toFixed(2) || "0.00"}</p></div>
          </div>
        </CardContent></Card>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <CardTitle>All Users</CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Profits</TableHead>
                  <TableHead>Withdrawn</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filtered?.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="font-medium">{u.full_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </TableCell>
                      <TableCell className="flex items-center gap-1"><Wallet className="h-3 w-3 text-muted-foreground" />${Number(u.total_balance).toFixed(2)}</TableCell>
                      <TableCell className="text-success">${Number(u.total_earnings).toFixed(2)}</TableCell>
                      <TableCell>${Number(u.total_withdrawn).toFixed(2)}</TableCell>
                      <TableCell><Badge variant={u.isAdmin ? "default" : "secondary"}>{u.isAdmin ? "Admin" : "User"}</Badge></TableCell>
                      <TableCell className="text-muted-foreground text-xs">{u.created_at ? format(new Date(u.created_at), "MMM d, yyyy") : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
