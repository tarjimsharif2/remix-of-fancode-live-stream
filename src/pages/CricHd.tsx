import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ChannelGrid } from "@/components/ChannelGrid";
import { useCricHdChannels } from "@/hooks/useCricHdChannels";
import { CricHdChannel } from "@/types/crichd";

const CricHd = () => {
  const { channels, loading, error, refetch } = useCricHdChannels();
  const navigate = useNavigate();

  const handleWatch = (channel: CricHdChannel) => {
    // Navigate with just the channel ID, like FanCode
    navigate(`/crichd/watch?id=${channel.id}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <ChannelGrid
          channels={channels}
          loading={loading}
          error={error}
          onWatch={handleWatch}
          onRefresh={refetch}
        />
      </main>
      <Footer />
    </div>
  );
};

export default CricHd;
