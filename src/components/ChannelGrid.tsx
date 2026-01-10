import { CricHdChannel } from "@/types/crichd";
import { ChannelCard } from "./ChannelCard";
import { Button } from "@/components/ui/button";
import { RefreshCw, Tv } from "lucide-react";

interface ChannelGridProps {
  channels: CricHdChannel[];
  loading: boolean;
  error: string | null;
  onWatch: (channel: CricHdChannel) => void;
  onRefresh: () => void;
}

export const ChannelGrid = ({ channels, loading, error, onWatch, onRefresh }: ChannelGridProps) => {
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-muted-foreground">Loading channels...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <div className="text-destructive text-lg">{error}</div>
          <Button onClick={onRefresh} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <Tv className="w-16 h-16 text-muted-foreground" />
          <p className="text-muted-foreground text-lg">No channels available</p>
          <Button onClick={onRefresh} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Tv className="w-6 h-6 text-primary" />
          <h2 className="text-xl font-semibold text-foreground">
            Live Channels ({channels.length})
          </h2>
        </div>
        <Button onClick={onRefresh} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {channels.map((channel) => (
          <ChannelCard key={channel.id} channel={channel} onWatch={onWatch} />
        ))}
      </div>
    </div>
  );
};
