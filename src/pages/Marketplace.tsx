import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Navbar } from "@/components/layout/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Coins, Plus, ShoppingCart, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export default function Marketplace() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [sellDialogOpen, setSellDialogOpen] = useState(false);
  const [buyDialogOpen, setBuyDialogOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState<any>(null);
  const [sellAmount, setSellAmount] = useState("");
  const [sellPrice, setSellPrice] = useState("1.00");
  const [buyAmount, setBuyAmount] = useState("");
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  // Fetch active listings
  const { data: listings = [] } = useQuery({
    queryKey: ["token-listings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("token_listings")
        .select("*, seller:profiles!token_listings_seller_id_fkey(full_name, email)")
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch user's own listings
  const { data: myListings = [] } = useQuery({
    queryKey: ["my-token-listings"],
    queryFn: async () => {
      const profileId = profile?.id;
      if (!profileId) return [];
      const { data, error } = await supabase
        .from("token_listings")
        .select("*")
        .eq("seller_id", profileId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  // Fetch user's transactions
  const { data: myTransactions = [] } = useQuery({
    queryKey: ["my-token-transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("token_transactions")
        .select("*, listing:token_listings(*), seller:profiles!token_transactions_seller_id_fkey(full_name), buyer:profiles!token_transactions_buyer_id_fkey(full_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("marketplace-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "token_listings" }, () => {
        queryClient.invalidateQueries({ queryKey: ["token-listings"] });
        queryClient.invalidateQueries({ queryKey: ["my-token-listings"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "token_transactions" }, () => {
        queryClient.invalidateQueries({ queryKey: ["my-token-transactions"] });
        queryClient.invalidateQueries({ queryKey: ["profile"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  const handleCreateListing = async () => {
    if (!profile) return;
    const amount = parseFloat(sellAmount);
    const price = parseFloat(sellPrice);
    if (!amount || amount <= 0 || !price || price <= 0) {
      toast({ title: "Invalid input", variant: "destructive" });
      return;
    }
    if (amount > Number(profile.token_balance || 0)) {
      toast({ title: "Insufficient token balance", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("token_listings").insert({
        seller_id: profile.id,
        amount,
        price_per_token: price,
        remaining_amount: amount,
      });
      if (error) throw error;

      // Deduct from token balance
      await supabase.from("profiles").update({
        token_balance: Number(profile.token_balance || 0) - amount,
      }).eq("id", profile.id);

      toast({ title: "Listing created!" });
      setSellDialogOpen(false);
      setSellAmount("");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleBuy = async () => {
    if (!profile || !selectedListing) return;
    const amount = parseFloat(buyAmount);
    if (!amount || amount <= 0 || amount > Number(selectedListing.remaining_amount)) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }
    if (selectedListing.seller_id === profile.id) {
      toast({ title: "Cannot buy your own listing", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      let proofUrl = null;
      if (paymentProof) {
        const ext = paymentProof.name.split(".").pop();
        const path = `token-payments/${profile.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("payment-proofs")
          .upload(path, paymentProof);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("payment-proofs").getPublicUrl(path);
        proofUrl = urlData.publicUrl;
      }

      const totalPrice = amount * Number(selectedListing.price_per_token);
      const { error } = await supabase.from("token_transactions").insert({
        listing_id: selectedListing.id,
        buyer_id: profile.id,
        seller_id: selectedListing.seller_id,
        amount,
        total_price: totalPrice,
        payment_proof_url: proofUrl,
      });
      if (error) throw error;

      toast({ title: "Purchase request submitted!", description: "Admin will verify your payment." });
      setBuyDialogOpen(false);
      setBuyAmount("");
      setPaymentProof(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelListing = async (listing: any) => {
    if (!profile) return;
    try {
      await supabase.from("token_listings").update({ status: "cancelled" }).eq("id", listing.id);
      // Refund tokens
      await supabase.from("profiles").update({
        token_balance: Number(profile.token_balance || 0) + Number(listing.remaining_amount),
      }).eq("id", profile.id);
      toast({ title: "Listing cancelled" });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-primary">Loading...</div>
      </div>
    );
  }

  const tokenBalance = Number(profile.token_balance || 0);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="mb-8 animate-fade-in">
          <h1 className="font-display text-3xl font-bold mb-2">
            <span className="gradient-text">QM Token Marketplace</span>
          </h1>
          <p className="text-muted-foreground">Buy and sell QM tokens from other users</p>
        </div>

        {/* Token Balance Card */}
        <Card className="glass-card mb-8 animate-fade-in">
          <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Coins className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Your QM Token Balance</p>
                <p className="text-3xl font-display font-bold">{tokenBalance.toFixed(2)} <span className="text-primary text-lg">QMT</span></p>
              </div>
            </div>
            <Button variant="hero" onClick={() => setSellDialogOpen(true)} disabled={tokenBalance <= 0}>
              <Plus className="h-4 w-4 mr-2" />
              Sell Tokens
            </Button>
          </CardContent>
        </Card>

        {/* Active Listings */}
        <Card className="glass-card mb-8 animate-fade-in" style={{ animationDelay: "0.1s" }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Available Listings
            </CardTitle>
          </CardHeader>
          <CardContent>
            {listings.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No active listings available</p>
            ) : (
              <div className="grid gap-4">
                {listings.map((listing: any) => (
                  <div key={listing.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-lg border border-border bg-secondary/30">
                    <div>
                      <p className="font-semibold">{Number(listing.remaining_amount).toFixed(2)} QMT available</p>
                      <p className="text-sm text-muted-foreground">
                        Price: ${Number(listing.price_per_token).toFixed(2)} / QMT
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Seller: {listing.seller?.full_name || listing.seller?.email || "Unknown"}
                      </p>
                    </div>
                    <Button
                      variant="hero"
                      size="sm"
                      disabled={listing.seller_id === profile.id}
                      onClick={() => {
                        setSelectedListing(listing);
                        setBuyAmount(String(listing.remaining_amount));
                        setBuyDialogOpen(true);
                      }}
                    >
                      {listing.seller_id === profile.id ? "Your Listing" : "Buy"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* My Listings */}
        {myListings.length > 0 && (
          <Card className="glass-card mb-8 animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <CardHeader>
              <CardTitle>My Listings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {myListings.map((listing: any) => (
                  <div key={listing.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/20">
                    <div>
                      <p className="font-medium">{Number(listing.remaining_amount).toFixed(2)} / {Number(listing.amount).toFixed(2)} QMT</p>
                      <p className="text-sm text-muted-foreground">${Number(listing.price_per_token).toFixed(2)} / QMT</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={listing.status === "active" ? "default" : "secondary"}>
                        {listing.status}
                      </Badge>
                      {listing.status === "active" && (
                        <Button variant="outline" size="sm" onClick={() => handleCancelListing(listing)}>
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* My Transactions */}
        {myTransactions.length > 0 && (
          <Card className="glass-card animate-fade-in" style={{ animationDelay: "0.3s" }}>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {myTransactions.map((tx: any) => (
                  <div key={tx.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 rounded-lg border border-border bg-secondary/20">
                    <div>
                      <p className="font-medium">
                        {tx.buyer_id === profile.id ? "Bought" : "Sold"} {Number(tx.amount).toFixed(2)} QMT
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Total: ${Number(tx.total_price).toFixed(2)} • {tx.buyer_id === profile.id ? `From: ${tx.seller?.full_name || "Unknown"}` : `To: ${tx.buyer?.full_name || "Unknown"}`}
                      </p>
                    </div>
                    <Badge variant={tx.status === "approved" ? "default" : tx.status === "rejected" ? "destructive" : "secondary"}>
                      {tx.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Sell Dialog */}
      <Dialog open={sellDialogOpen} onOpenChange={setSellDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sell QM Tokens</DialogTitle>
            <DialogDescription>Create a listing for other users to buy your tokens</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Amount (max: {tokenBalance.toFixed(2)})</Label>
              <Input type="number" value={sellAmount} onChange={(e) => setSellAmount(e.target.value)} placeholder="Enter amount" />
            </div>
            <div>
              <Label>Price per Token (USD)</Label>
              <Input type="number" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} placeholder="1.00" />
            </div>
            <Button variant="hero" className="w-full" onClick={handleCreateListing} disabled={submitting}>
              {submitting ? "Creating..." : "Create Listing"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Buy Dialog */}
      <Dialog open={buyDialogOpen} onOpenChange={setBuyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buy QM Tokens</DialogTitle>
            <DialogDescription>
              {selectedListing && `Price: $${Number(selectedListing.price_per_token).toFixed(2)} / QMT`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Amount (max: {selectedListing ? Number(selectedListing.remaining_amount).toFixed(2) : 0})</Label>
              <Input type="number" value={buyAmount} onChange={(e) => setBuyAmount(e.target.value)} placeholder="Enter amount" />
            </div>
            {buyAmount && selectedListing && (
              <p className="text-sm text-muted-foreground">
                Total: <span className="font-bold text-foreground">${(parseFloat(buyAmount) * Number(selectedListing.price_per_token)).toFixed(2)}</span>
              </p>
            )}
            <div>
              <Label>Payment Proof (screenshot)</Label>
              <Input type="file" accept="image/*" onChange={(e) => setPaymentProof(e.target.files?.[0] || null)} />
            </div>
            <Button variant="hero" className="w-full" onClick={handleBuy} disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Purchase"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
