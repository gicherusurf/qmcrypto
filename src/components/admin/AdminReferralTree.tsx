import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, Users, ChevronRight, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface UserNode {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  referral_code: string;
  referred_by: string | null;
  total_balance: number;
  total_earnings: number;
  children?: UserNode[];
}

function ReferralNode({ user, level = 0, allUsers }: { user: UserNode; level?: number; allUsers: UserNode[] }) {
  const [expanded, setExpanded] = useState(level < 2);
  const children = allUsers.filter(u => u.referred_by === user.id);

  return (
    <div className={cn("relative", level > 0 && "ml-6")}>
      {level > 0 && (
        <div className="absolute left-0 top-0 h-6 w-6 -translate-x-full border-l-2 border-b-2 border-border rounded-bl-lg" />
      )}
      
      <div
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all",
          "bg-secondary/30 border border-border/50 hover:border-primary/50",
          children.length > 0 && "cursor-pointer"
        )}
        onClick={() => children.length > 0 && setExpanded(!expanded)}
      >
        <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10">
          <User className="h-5 w-5 text-primary" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{user.full_name || "Unknown"}</span>
            {children.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {children.length} referral{children.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="truncate">{user.email}</span>
            <code className="text-primary text-xs">{user.referral_code}</code>
          </div>
        </div>

        <div className="text-right">
          <div className="text-sm font-semibold">${Number(user.total_balance).toFixed(2)}</div>
          <div className="text-xs text-success">+${Number(user.total_earnings).toFixed(2)}</div>
        </div>

        {children.length > 0 && (
          <ChevronRight 
            className={cn(
              "h-5 w-5 text-muted-foreground transition-transform",
              expanded && "rotate-90"
            )} 
          />
        )}
      </div>

      {expanded && children.length > 0 && (
        <div className="mt-2 space-y-2 pl-4 border-l-2 border-border">
          {children.map((child) => (
            <ReferralNode key={child.id} user={child} level={level + 1} allUsers={allUsers} />
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminReferralTree() {
  const [search, setSearch] = useState("");

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-referral-tree"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      return data as UserNode[];
    },
  });

  // Find root users (those not referred by anyone)
  const rootUsers = users?.filter(u => !u.referred_by) || [];

  // Filter tree based on search
  const filteredRootUsers = search 
    ? users?.filter(u => 
        u.email?.toLowerCase().includes(search.toLowerCase()) ||
        u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        u.referral_code?.toLowerCase().includes(search.toLowerCase())
      ) || []
    : rootUsers;

  // Calculate stats
  const stats = {
    totalUsers: users?.length || 0,
    withReferrals: users?.filter(u => users?.some(child => child.referred_by === u.id)).length || 0,
    avgReferrals: users && users.length > 0 
      ? (users.filter(u => u.referred_by).length / Math.max(rootUsers.length, 1)).toFixed(1)
      : "0",
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-2xl font-display font-bold">{stats.totalUsers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-success/10">
                <Users className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">With Referrals</p>
                <p className="text-2xl font-display font-bold text-success">{stats.withReferrals}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-accent/10">
                <Users className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Referrals/User</p>
                <p className="text-2xl font-display font-bold text-accent">{stats.avgReferrals}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tree View */}
      <Card className="glass-card">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <CardTitle>Referral Network</CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredRootUsers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {search ? "No users match your search." : "No users yet."}
            </p>
          ) : (
            <div className="space-y-3">
              {filteredRootUsers.map((user) => (
                <ReferralNode key={user.id} user={user} allUsers={users || []} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
