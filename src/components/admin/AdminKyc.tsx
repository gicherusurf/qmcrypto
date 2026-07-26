import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Check, X, ExternalLink, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

type ProfileLite = { full_name: string | null; email: string | null } | null;

export function AdminKyc() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["admin-kyc"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kyc_verifications")
        .select("*, profiles(full_name, email)")
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    refetchInterval: 15000,
  });

  const viewDocument = async (path: string) => {
    const { data, error } = await supabase.storage.from("kyc-documents").createSignedUrl(path, 300);
    if (error || !data) {
      toast({ title: "Error", description: "Could not load document", variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const decide = async (id: string, approve: boolean) => {
    setBusyId(id);
    try {
      const { error } = await supabase
        .from("kyc_verifications")
        .update({
          status: approve ? "approved" : "rejected",
          admin_notes: notes[id] || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
      toast({ title: approve ? "ID approved" : "ID rejected" });
      qc.invalidateQueries({ queryKey: ["admin-kyc"] });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const pending = data?.filter((k) => k.status === "pending") || [];
  const reviewed = data?.filter((k) => k.status !== "pending") || [];

  return (
    <div className="space-y-6">
      <Card className="glass-card">
        <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />Pending ID Verifications</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : pending.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No pending submissions.</p>
          ) : (
            <div className="space-y-4">
              {pending.map((k) => {
                const p = k.profiles as ProfileLite;
                return (
                  <div key={k.id} className="p-4 rounded-lg border border-border space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <div className="font-medium">{p?.full_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{p?.email}</div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => viewDocument(k.document_url)}>
                        <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> View ID
                      </Button>
                    </div>
                    <Textarea
                      placeholder="Notes (optional, visible to user if rejected)"
                      value={notes[k.id] || ""}
                      onChange={(e) => setNotes((n) => ({ ...n, [k.id]: e.target.value }))}
                      className="text-sm"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => decide(k.id, true)} disabled={busyId === k.id} className="flex-1">
                        <Check className="h-4 w-4 mr-1.5" /> Approve
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => decide(k.id, false)} disabled={busyId === k.id} className="flex-1">
                        <X className="h-4 w-4 mr-1.5" /> Reject
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader><CardTitle>Reviewed</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Reviewed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviewed.map((k) => {
                  const p = k.profiles as ProfileLite;
                  return (
                    <TableRow key={k.id}>
                      <TableCell>
                        <div className="text-sm font-medium">{p?.full_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{p?.email}</div>
                      </TableCell>
                      <TableCell><Badge variant={k.status === "approved" ? "default" : "outline"}>{k.status}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{k.admin_notes || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{k.reviewed_at ? format(new Date(k.reviewed_at), "MMM d, yyyy") : "—"}</TableCell>
                    </TableRow>
                  );
                })}
                {reviewed.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No reviewed submissions yet</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
