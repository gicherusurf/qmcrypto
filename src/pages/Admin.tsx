import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Navbar } from "@/components/layout/Navbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, ArrowUpRight, Settings, DollarSign, Radio } from "lucide-react";
import { AdminUsers } from "@/components/admin/AdminUsers";
import { AdminWithdrawals } from "@/components/admin/AdminWithdrawals";
import { AdminSettings } from "@/components/admin/AdminSettings";
import { AdminDeposits } from "@/components/admin/AdminDeposits";
import { AdminSignals } from "@/components/admin/AdminSignals";

export default function Admin() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) navigate("/dashboard");
  }, [user, isAdmin, loading, navigate]);

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-pulse text-primary">Loading...</div></div>;
  }
  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="mb-8 animate-fade-in">
          <h1 className="font-display text-3xl font-bold mb-2"><span className="gradient-text">Admin Panel</span></h1>
          <p className="text-muted-foreground">Manage deposits, signals, withdrawals, and platform settings</p>
        </div>

        <Tabs defaultValue="deposits" className="space-y-6">
          <TabsList className="bg-secondary/50 border border-border flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="deposits" className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3">
              <DollarSign className="h-3 w-3 sm:h-4 sm:w-4" /><span>Deposits</span>
            </TabsTrigger>
            <TabsTrigger value="signals" className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3">
              <Radio className="h-3 w-3 sm:h-4 sm:w-4" /><span>Signals</span>
            </TabsTrigger>
            <TabsTrigger value="withdrawals" className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3">
              <ArrowUpRight className="h-3 w-3 sm:h-4 sm:w-4" /><span>Withdrawals</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3">
              <Users className="h-3 w-3 sm:h-4 sm:w-4" /><span>Users</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3">
              <Settings className="h-3 w-3 sm:h-4 sm:w-4" /><span>Settings</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="deposits"><AdminDeposits /></TabsContent>
          <TabsContent value="signals"><AdminSignals /></TabsContent>
          <TabsContent value="withdrawals"><AdminWithdrawals /></TabsContent>
          <TabsContent value="users"><AdminUsers /></TabsContent>
          <TabsContent value="settings"><AdminSettings /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
