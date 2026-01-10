import { CricHdChannel } from "@/types/crichd";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Tv } from "lucide-react";

interface ChannelCardProps {
  channel: CricHdChannel;
  onWatch: (channel: CricHdChannel) => void;
}

export const ChannelCard = ({ channel, onWatch }: ChannelCardProps) => {
  return (
    <Card className="group overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/50 transition-all duration-300">
      <CardContent className="p-0">
        <div className="relative aspect-video bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
          {channel.logo ? (
            <img
              src={channel.logo}
              alt={channel.name}
              className="w-24 h-24 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : null}
          <div className={`${channel.logo ? 'hidden' : ''} flex items-center justify-center`}>
            <Tv className="w-16 h-16 text-primary/50" />
          </div>
          
          {/* Live indicator */}
          <div className="absolute top-2 left-2">
            <span className="px-2 py-1 text-xs font-bold bg-red-600 text-white rounded-full animate-pulse">
              LIVE
            </span>
          </div>
        </div>
        
        <div className="p-4 space-y-3">
          <h3 className="font-semibold text-foreground text-center line-clamp-1">
            {channel.name}
          </h3>
          
          <Button
            onClick={() => onWatch(channel)}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Play className="w-4 h-4 mr-2" />
            Watch Now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
