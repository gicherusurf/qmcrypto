import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Zap, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export function AdminSignals() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [genBusy, setGenBusy] = useState(false);
  const [closeBusy, setCloseBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-signals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signals")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const triggerGenerate = async () => {
    setGenBusy(true);
    try {
      const { error } = await supabase.functions.invoke("generate-signal");
      if (error) throw error;
      toast({ title: "Signal generated" });
      qc.invalidateQueries({ queryKey: ["admin-signals"] });
      qc.invalidateQueries({ queryKey: ["signals"] });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setGenBusy(false);
    }
  };

  const triggerClose = async () => {
    setCloseBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("close-signals");
      if (error) throw error;
      const closed = (data as { closed?: number } | null)?.closed ?? 0;
      toast({ title: `Closed ${closed} signal(s)` });
      qc.invalidateQueries({ queryKey: ["admin-signals"] });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setCloseBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="glass-card">
        <CardHeader><CardTitle>Signal Controls</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button onClick={triggerGenerate} disabled={genBusy} variant="hero">
            {genBusy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
            Generate Signal Now
          </Button>
          <Button onClick={triggerClose} disabled={closeBusy} variant="outline">
            {closeBusy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
            Process Due Closures
          </Button>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader><CardTitle>Recent Signals</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pair</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead>Entry</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Profit %</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Closes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.pair}</TableCell>
                      <TableCell><Badge variant={s.direction === "LONG" ? "default" : "secondary"}>{s.direction}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{Number(s.entry_price).toLocaleString()}</TableCell>
                      <TableCell className="font-mono text-xs">{Number(s.target_price).toLocaleString()}</TableCell>
                      <TableCell>{Number(s.profit_percentage).toFixed(2)}%</TableCell>
                      <TableCell><Badge variant={s.status === "open" ? "default" : "outline"}>{s.status}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(s.created_at), "MMM d HH:mm")}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(s.closes_at), "MMM d HH:mm")}</TableCell>
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
