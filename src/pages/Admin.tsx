import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Navbar } from "@/components/layout/Navbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, ArrowUpRight, GitBranch, Settings, Clock, DollarSign, Coins } from "lucide-react";
import { AdminUsers } from "@/components/admin/AdminUsers";
import { AdminWithdrawals } from "@/components/admin/AdminWithdrawals";
import { AdminReferralTree } from "@/components/admin/AdminReferralTree";
import { AdminSettings } from "@/components/admin/AdminSettings";
import { AdminPendingInvestments } from "@/components/admin/AdminPendingInvestments";
import { AdminAllDeposits } from "@/components/admin/AdminAllDeposits";

export default function Admin() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate("/dashboard");
    }
  }, [user, isAdmin, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-primary">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="mb-8 animate-fade-in">
          <h1 className="font-display text-3xl font-bold mb-2">
            <span className="gradient-text">Admin Panel</span>
          </h1>
          <p className="text-muted-foreground">Manage users, withdrawals, and platform settings</p>
        </div>

        <Tabs defaultValue="pending" className="space-y-6">
          <TabsList className="bg-secondary/50 border border-border flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="pending" className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3">
              <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Pending</span>
            </TabsTrigger>
            <TabsTrigger value="deposits" className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3">
              <DollarSign className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Deposits</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3">
              <Users className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Users</span>
            </TabsTrigger>
            <TabsTrigger value="withdrawals" className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3">
              <ArrowUpRight className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Withdrawals</span>
            </TabsTrigger>
            <TabsTrigger value="referrals" className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3">
              <GitBranch className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Referrals</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3">
              <Settings className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="animate-fade-in">
            <AdminPendingInvestments />
          </TabsContent>

          <TabsContent value="deposits" className="animate-fade-in">
            <AdminAllDeposits />
          </TabsContent>

          <TabsContent value="users" className="animate-fade-in">
            <AdminUsers />
          </TabsContent>

          <TabsContent value="withdrawals" className="animate-fade-in">
            <AdminWithdrawals />
          </TabsContent>

          <TabsContent value="referrals" className="animate-fade-in">
            <AdminReferralTree />
          </TabsContent>

          <TabsContent value="settings" className="animate-fade-in">
            <AdminSettings />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
