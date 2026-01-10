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
    // Encode the channel data in URL params
    const params = new URLSearchParams({
      id: channel.id,
      name: channel.name,
      link: channel.link,
      referer: channel.referer,
      origin: channel.origin,
    });
    navigate(`/crichd/watch?${params.toString()}`);
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
