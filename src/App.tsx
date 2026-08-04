import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Signals from "./pages/Signals";
import TradeHistory from "./pages/TradeHistory";
import Admin from "./pages/Admin";
import Affiliate from "./pages/Affiliate";
import Franchise from "./pages/Franchise";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/signals" element={<Signals />} />
            <Route path="/history" element={<TradeHistory />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/affiliate" element={<Affiliate />} />
            <Route path="/franchise" element={<Franchise />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <PWAInstallPrompt />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
