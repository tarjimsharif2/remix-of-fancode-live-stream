import { useState } from "react";
import { Header } from "@/components/Header";
import { MatchGrid } from "@/components/MatchGrid";
import { Footer } from "@/components/Footer";
import { VideoPlayer } from "@/components/VideoPlayer";
import { useMatches } from "@/hooks/useMatches";
import { Match } from "@/types/match";

const Index = () => {
  const { matches, loading, error, lastUpdated, refetch } = useMatches();
  const [selectedMatch, setSelectedMatch] = useState<{ match: Match; region: 'BD' | 'IN' } | null>(null);

  const handleWatch = (match: Match, region: 'BD' | 'IN') => {
    const streamUrl = region === 'BD' ? match.streamLinkBD : match.streamLinkIN;
    if (streamUrl) {
      setSelectedMatch({ match, region });
    }
  };

  const handleClosePlayer = () => {
    setSelectedMatch(null);
  };

  const getStreamUrl = () => {
    if (!selectedMatch) return '';
    return selectedMatch.region === 'BD' 
      ? selectedMatch.match.streamLinkBD 
      : selectedMatch.match.streamLinkIN;
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <MatchGrid
          matches={matches}
          loading={loading}
          error={error}
          lastUpdated={lastUpdated}
          onWatch={handleWatch}
          onRefresh={refetch}
        />
      </main>
      <Footer />

      {selectedMatch && getStreamUrl() && (
        <VideoPlayer
          streamUrl={getStreamUrl()!}
          matchName={`${selectedMatch.match.team1} vs ${selectedMatch.match.team2} (${selectedMatch.region})`}
          onClose={handleClosePlayer}
        />
      )}
    </div>
  );
};

export default Index;
