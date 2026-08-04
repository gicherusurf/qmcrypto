import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Loader2, Users, DollarSign, Wallet, Ban, Trash2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

type UserRoleName = "user" | "moderator" | "admin" | "franchise";

export function AdminUsers() {
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      return profiles?.map((p) => {
        const roleRow = roles?.find((r) => r.user_id === p.user_id);
        const role: UserRoleName = (roleRow?.role as UserRoleName) || "user";
        return { ...p, role };
      }) || [];
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
    u.email?.toLowerCase().includes(search.toLowerCase()) || u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.phone_number?.toLowerCase().includes(search.toLowerCase())
  );

  const changeRole = async (targetUserId: string, role: UserRoleName) => {
    setUpdatingId(targetUserId);
    try {
      const { error } = await supabase.rpc("set_user_role", { _target_user_id: targetUserId, _role: role });
      if (error) throw error;
      toast({ title: "Role updated", description: `User is now ${role}` });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to update role";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setUpdatingId(null);
    }
  };

  const toggleBan = async (profileId: string, currentlyBanned: boolean, name: string) => {
    if (!currentlyBanned) {
      const reason = window.prompt(`Ban ${name}? Optionally enter a reason:`, "");
      if (reason === null) return; // cancelled
      setUpdatingId(profileId);
      try {
        const { error } = await supabase.rpc("set_user_banned", { _target_profile_id: profileId, _banned: true, _reason: reason || null });
        if (error) throw error;
        toast({ title: "User banned", description: `${name} can no longer trade, deposit, or withdraw.` });
        qc.invalidateQueries({ queryKey: ["admin-users"] });
      } catch (e: unknown) {
        toast({ title: "Error", description: e instanceof Error ? e.message : "Failed to ban", variant: "destructive" });
      } finally {
        setUpdatingId(null);
      }
    } else {
      setUpdatingId(profileId);
      try {
        const { error } = await supabase.rpc("set_user_banned", { _target_profile_id: profileId, _banned: false });
        if (error) throw error;
        toast({ title: "User unbanned", description: `${name}'s access has been restored.` });
        qc.invalidateQueries({ queryKey: ["admin-users"] });
      } catch (e: unknown) {
        toast({ title: "Error", description: e instanceof Error ? e.message : "Failed to unban", variant: "destructive" });
      } finally {
        setUpdatingId(null);
      }
    }
  };

  const removeUser = async (profileId: string, name: string) => {
    if (!window.confirm(`Permanently delete ${name}? This cannot be undone. Users with balances, referrals, or financial history are protected and cannot be deleted (ban them instead).`)) return;
    setUpdatingId(profileId);
    try {
      const { error } = await supabase.rpc("admin_delete_user", { _target_profile_id: profileId });
      if (error) throw error;
      toast({ title: "User deleted", description: `${name} has been permanently removed.` });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e: unknown) {
      toast({ title: "Cannot delete user", description: e instanceof Error ? e.message : "Failed to delete", variant: "destructive" });
    } finally {
      setUpdatingId(null);
    }
  };

  const roleBadgeVariant = (role: UserRoleName) =>
    role === "admin" ? "default" : role === "moderator" ? "secondary" : "outline";

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
                  <TableHead>Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filtered?.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="font-medium flex items-center gap-2">
                          {u.full_name || "—"}
                          {u.banned && <Badge variant="destructive" className="text-[10px]">Banned</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                        {u.phone_number && <div className="text-xs text-muted-foreground">{u.phone_number}</div>}
                        {u.banned && u.ban_reason && <div className="text-[10px] text-destructive">Reason: {u.ban_reason}</div>}
                      </TableCell>
                      <TableCell className="flex items-center gap-1"><Wallet className="h-3 w-3 text-muted-foreground" />${Number(u.total_balance).toFixed(2)}</TableCell>
                      <TableCell className="text-success">${Number(u.total_earnings).toFixed(2)}</TableCell>
                      <TableCell>${Number(u.total_withdrawn).toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant={roleBadgeVariant(u.role)} className="capitalize">{u.role}</Badge>
                          <Select
                            value={u.role}
                            disabled={updatingId === u.user_id}
                            onValueChange={(value) => changeRole(u.user_id, value as UserRoleName)}
                          >
                            <SelectTrigger className="h-7 w-[110px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">User</SelectItem>
                              <SelectItem value="moderator">Moderator</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="franchise">Franchise</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">{u.created_at ? format(new Date(u.created_at), "MMM d, yyyy") : "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant={u.banned ? "outline" : "ghost"}
                            className="h-7 px-2 text-xs"
                            disabled={updatingId === u.id || u.role === "admin"}
                            onClick={() => toggleBan(u.id, !!u.banned, u.full_name || u.email || "user")}
                            title={u.role === "admin" ? "Cannot ban an admin" : u.banned ? "Unban user" : "Ban user"}
                          >
                            {u.banned ? <ShieldCheck className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                            <span className="ml-1">{u.banned ? "Unban" : "Ban"}</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                            disabled={updatingId === u.id || u.role === "admin"}
                            onClick={() => removeUser(u.id, u.full_name || u.email || "user")}
                            title={u.role === "admin" ? "Cannot delete an admin" : "Permanently delete user"}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
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
