import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Navbar } from "@/components/layout/Navbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, ArrowUpRight, GitBranch, Settings, Clock } from "lucide-react";
import { AdminUsers } from "@/components/admin/AdminUsers";
import { AdminWithdrawals } from "@/components/admin/AdminWithdrawals";
import { AdminReferralTree } from "@/components/admin/AdminReferralTree";
import { AdminSettings } from "@/components/admin/AdminSettings";
import { AdminPendingInvestments } from "@/components/admin/AdminPendingInvestments";

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
          <TabsList className="bg-secondary/50 border border-border">
            <TabsTrigger value="pending" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Pending
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="withdrawals" className="flex items-center gap-2">
              <ArrowUpRight className="h-4 w-4" />
              Withdrawals
            </TabsTrigger>
            <TabsTrigger value="referrals" className="flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              Referral Tree
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="animate-fade-in">
            <AdminPendingInvestments />
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
