import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Watch from "./pages/Watch";
import WatchWorldwide from "./pages/WatchWorldwide";
import CricHd from "./pages/CricHd";
import CricHdWatch from "./pages/CricHdWatch";
import MyPlay from "./pages/MyPlay";
import MyPlayWatch from "./pages/MyPlayWatch";
import Playlist from "./pages/Playlist";
import PlaylistWatch from "./pages/PlaylistWatch";
import LiveSource from "./pages/LiveSource";
import LiveSourceWatch from "./pages/LiveSourceWatch";
import YouTubeLive from "./pages/YouTubeLive";
import Admin from "./pages/Admin";
import AdminAuth from "./pages/AdminAuth";
import NotFound from "./pages/NotFound";
import { ReferrerGuard } from "./components/ReferrerGuard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ReferrerGuard>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/fancode/play-bd.php" element={<Watch />} />
            <Route path="/fancode/play-in.php" element={<Watch />} />
            <Route path="/fancode/play-ww.php" element={<WatchWorldwide />} />
            <Route path="/crichd" element={<CricHd />} />
            <Route path="/crichd/watch" element={<CricHdWatch />} />
            <Route path="/myplay" element={<MyPlay />} />
            <Route path="/myplay/watch" element={<MyPlayWatch />} />
            <Route path="/playlist/:slug" element={<Playlist />} />
            <Route path="/playlist/:slug/watch" element={<PlaylistWatch />} />
            {/* Dynamic JSON Sources */}
            <Route path="/live/:slug" element={<LiveSource />} />
            <Route path="/live/:slug/play-bd" element={<LiveSourceWatch />} />
            <Route path="/live/:slug/play-in" element={<LiveSourceWatch />} />
            <Route path="/live/:slug/play-ww" element={<LiveSourceWatch />} />
            <Route path="/youtube" element={<YouTubeLive />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/login" element={<AdminAuth />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ReferrerGuard>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
