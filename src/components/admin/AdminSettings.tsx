import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const FIELDS = [
  { key: "usdt_trc20_wallet", label: "USDT Wallet (TRC20)" },
];

export function AdminSettings() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("*");
      if (error) throw error;
      const map: Record<string, string> = {};
      data?.forEach((s) => { map[s.key] = s.value ?? ""; });
      return map;
    },
  });

  useEffect(() => {
    if (settings) {
      const next: Record<string, string> = {};
      FIELDS.forEach((f) => { next[f.key] = settings[f.key] ?? ""; });
      setForm(next);
    }
  }, [settings]);

  const save = async () => {
    setSaving(true);
    try {
      for (const f of FIELDS) {
        const { error } = await supabase
          .from("settings")
          .upsert({ key: f.key, value: form[f.key] ?? "", updated_at: new Date().toISOString() }, { onConflict: "key" });
        if (error) throw error;
      }
      toast({ title: "Settings saved" });
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5 text-primary" /> Deposit Wallets</CardTitle>
        <CardDescription>Wallet addresses shown to users when they deposit.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {FIELDS.map((f) => (
          <div key={f.key} className="space-y-2">
            <Label htmlFor={f.key}>{f.label}</Label>
            <Input id={f.key} value={form[f.key] || ""} onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))} />
          </div>
        ))}
        <Button onClick={save} disabled={saving} variant="hero">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save
        </Button>
      </CardContent>
    </Card>
  );
}
