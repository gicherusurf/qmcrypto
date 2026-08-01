import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck, X, Upload, Clock, CheckCircle2 } from "lucide-react";

// Non-blocking KYC prompt shown on the dashboard. Users can dismiss it for the
// session, but it returns on reload until KYC is submitted. Reuses the same
// upload path + kyc_verifications insert as the withdrawal dialog, so a single
// submission satisfies both. The withdrawal-time gate is unchanged.
export function KycPromptBanner() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dismissed, setDismissed] = useState(false);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: kyc, isLoading } = useQuery({
    queryKey: ["my-kyc-status"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_kyc_status");
      if (error) throw error;
      return data && data.length > 0 ? data[0] : null;
    },
  });

  const handleUpload = async () => {
    if (!idFile || !profile?.user_id || !profile?.id) return;
    setUploading(true);
    try {
      const ext = idFile.name.split(".").pop();
      const path = `${profile.user_id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("kyc-documents").upload(path, idFile);
      if (uploadError) throw uploadError;
      const { error: insertError } = await supabase.from("kyc_verifications").insert({
        user_id: profile.id,
        document_url: path,
      });
      if (insertError) throw insertError;
      toast({ title: "ID submitted", description: "Your document is under review. This usually takes a short while." });
      setIdFile(null);
      qc.invalidateQueries({ queryKey: ["my-kyc-status"] });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Upload failed";
      toast({ title: "Failed to submit ID", description: msg, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  // Don't show while loading, if approved, if pending review, or if dismissed this session
  if (isLoading || dismissed) return null;
  if (kyc && kyc.status === "approved") return null;

  // Pending review — show a subtle confirmation (not dismissible clutter, informative)
  if (kyc && kyc.status === "pending") {
    return (
      <div className="mb-6 rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-center gap-3">
        <Clock className="h-5 w-5 text-primary shrink-0" />
        <div className="flex-1 text-sm">
          <p className="font-medium">Identity verification in review</p>
          <p className="text-muted-foreground">Your ID is being reviewed. You'll be able to withdraw once it's approved.</p>
        </div>
      </div>
    );
  }

  // Not submitted, or rejected — show the upload prompt
  const isRejected = kyc && kyc.status === "rejected";
  return (
    <div className="mb-6 rounded-xl border border-primary/40 bg-gradient-to-br from-primary/10 to-transparent p-5 relative">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 p-1 rounded hover:bg-secondary text-muted-foreground"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-full bg-primary/15 shrink-0">
          <ShieldCheck className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold">
            {isRejected ? "Re-submit your ID for verification" : "Verify your identity to unlock withdrawals"}
          </p>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isRejected
              ? "Your previous submission wasn't approved. Please upload a clear photo of your ID or passport."
              : "Upload a clear photo of your ID or passport now so you're ready to withdraw your profits later. You can keep using signals in the meantime."}
          </p>
          {isRejected && kyc?.admin_notes && (
            <p className="text-xs text-destructive mt-1">Reason: {kyc.admin_notes}</p>
          )}
          <div className="flex flex-col sm:flex-row gap-2 mt-3">
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => setIdFile(e.target.files?.[0] || null)}
              className="text-sm"
            />
            <Button onClick={handleUpload} disabled={!idFile || uploading} className="shrink-0">
              {uploading ? (
                <>Uploading...</>
              ) : (
                <><Upload className="h-4 w-4 mr-1.5" /> Submit ID</>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
