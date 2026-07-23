import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Navbar } from "@/components/layout/Navbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, ArrowUpRight, Settings, DollarSign, Radio, LayoutDashboard, History, Gift } from "lucide-react";
import { AdminUsers } from "@/components/admin/AdminUsers";
import { AdminWithdrawals } from "@/components/admin/AdminWithdrawals";
import { AdminSettings } from "@/components/admin/AdminSettings";
import { AdminDeposits } from "@/components/admin/AdminDeposits";
import { AdminSignals } from "@/components/admin/AdminSignals";
import { AdminOverview } from "@/components/admin/AdminOverview";
import { AdminDepositsHistory } from "@/components/admin/AdminDepositsHistory";
import { AdminReferrals } from "@/components/admin/AdminReferrals";

export default function Admin() {
  const { user, isAdmin, isModerator, loading } = useAuth();
  const navigate = useNavigate();
  const hasAccess = isAdmin || isModerator;

  useEffect(() => {
    if (!loading && (!user || !hasAccess)) navigate("/dashboard");
  }, [user, hasAccess, loading, navigate]);

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-pulse text-primary">Loading...</div></div>;
  }
  if (!hasAccess) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="mb-8 animate-fade-in">
          <h1 className="font-display text-3xl font-bold mb-2"><span className="gradient-text">{isAdmin ? "Admin Panel" : "Moderator Panel"}</span></h1>
          <p className="text-muted-foreground">
            {isAdmin ? "Manage deposits, signals, withdrawals, and platform settings" : "Manage deposits and withdrawals"}
          </p>
        </div>

        <Tabs defaultValue={isAdmin ? "overview" : "deposits"} className="space-y-6">
          <TabsList className="bg-secondary/50 border border-border flex-wrap h-auto gap-1 p-1">
            {isAdmin && (
              <TabsTrigger value="overview" className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3">
                <LayoutDashboard className="h-3 w-3 sm:h-4 sm:w-4" /><span>Overview</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="deposits" className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3">
              <DollarSign className="h-3 w-3 sm:h-4 sm:w-4" /><span>Deposits</span>
            </TabsTrigger>
            <TabsTrigger value="deposits-history" className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3">
              <History className="h-3 w-3 sm:h-4 sm:w-4" /><span>Dep. History</span>
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="referrals" className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3">
                <Gift className="h-3 w-3 sm:h-4 sm:w-4" /><span>Referrals</span>
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="signals" className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3">
                <Radio className="h-3 w-3 sm:h-4 sm:w-4" /><span>Signals</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="withdrawals" className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3">
              <ArrowUpRight className="h-3 w-3 sm:h-4 sm:w-4" /><span>Withdrawals</span>
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="users" className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3">
                <Users className="h-3 w-3 sm:h-4 sm:w-4" /><span>Users</span>
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="settings" className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3">
                <Settings className="h-3 w-3 sm:h-4 sm:w-4" /><span>Settings</span>
              </TabsTrigger>
            )}
          </TabsList>

          {isAdmin && <TabsContent value="overview"><AdminOverview /></TabsContent>}
          <TabsContent value="deposits"><AdminDeposits /></TabsContent>
          <TabsContent value="deposits-history"><AdminDepositsHistory /></TabsContent>
          {isAdmin && <TabsContent value="referrals"><AdminReferrals /></TabsContent>}
          {isAdmin && <TabsContent value="signals"><AdminSignals /></TabsContent>}
          <TabsContent value="withdrawals"><AdminWithdrawals /></TabsContent>
          {isAdmin && <TabsContent value="users"><AdminUsers /></TabsContent>}
          {isAdmin && <TabsContent value="settings"><AdminSettings /></TabsContent>}
        </Tabs>
      </main>
    </div>
  );
}
