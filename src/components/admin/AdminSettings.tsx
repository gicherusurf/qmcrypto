import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export function AdminSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("settings")
        .select("*");
      
      if (error) throw error;
      
      // Convert to key-value object
      return data?.reduce((acc, s) => {
        acc[s.key] = s.value;
        return acc;
      }, {} as Record<string, string | null>) || {};
    },
  });

  const [formData, setFormData] = useState({
    platform_name: settings?.platform_name || "CryptoGains",
    return_percentage: settings?.return_percentage || "10",
    return_period_days: settings?.return_period_days || "14",
    min_withdrawal: settings?.min_withdrawal || "10",
    withdrawals_enabled: settings?.withdrawals_enabled !== "false",
    new_investments_enabled: settings?.new_investments_enabled !== "false",
  });

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const updates = Object.entries(formData).map(([key, value]) => ({
        key,
        value: String(value),
        updated_at: new Date().toISOString(),
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from("settings")
          .upsert(update, { onConflict: "key" });
        
        if (error) throw error;
      }

      toast({
        title: "Settings Saved",
        description: "Platform settings have been updated.",
      });

      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Platform Settings
          </CardTitle>
          <CardDescription>
            Configure platform-wide settings and parameters
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="platform_name">Platform Name</Label>
              <Input
                id="platform_name"
                value={formData.platform_name}
                onChange={(e) => setFormData(prev => ({ ...prev, platform_name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="min_withdrawal">Minimum Withdrawal ($)</Label>
              <Input
                id="min_withdrawal"
                type="number"
                value={formData.min_withdrawal}
                onChange={(e) => setFormData(prev => ({ ...prev, min_withdrawal: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="return_percentage">Return Percentage (%)</Label>
              <Input
                id="return_percentage"
                type="number"
                value={formData.return_percentage}
                onChange={(e) => setFormData(prev => ({ ...prev, return_percentage: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="return_period_days">Return Period (Days)</Label>
              <Input
                id="return_period_days"
                type="number"
                value={formData.return_period_days}
                onChange={(e) => setFormData(prev => ({ ...prev, return_period_days: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-border">
            <h4 className="font-medium">Platform Controls</h4>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Withdrawals Enabled</Label>
                <p className="text-sm text-muted-foreground">Allow users to request withdrawals</p>
              </div>
              <Switch
                checked={formData.withdrawals_enabled}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, withdrawals_enabled: checked }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>New Investments Enabled</Label>
                <p className="text-sm text-muted-foreground">Allow users to create new investments</p>
              </div>
              <Switch
                checked={formData.new_investments_enabled}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, new_investments_enabled: checked }))}
              />
            </div>
          </div>

          <Button onClick={handleSave} disabled={isSaving} variant="hero" className="w-full sm:w-auto">
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
