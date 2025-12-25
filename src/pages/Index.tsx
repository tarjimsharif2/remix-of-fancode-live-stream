import { useState } from "react";
import { Header } from "@/components/Header";
import { MatchGrid } from "@/components/MatchGrid";
import { Footer } from "@/components/Footer";
import { VideoPlayer } from "@/components/VideoPlayer";
import { useMatches } from "@/hooks/useMatches";
import { Match } from "@/types/match";

const Index = () => {
  const { matches, loading, error, lastUpdated, refetch } = useMatches();
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

  const handleWatch = (match: Match) => {
    if (match.streamLink) {
      setSelectedMatch(match);
    }
  };

  const handleClosePlayer = () => {
    setSelectedMatch(null);
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

      {selectedMatch && selectedMatch.streamLink && (
        <VideoPlayer
          streamUrl={selectedMatch.streamLink}
          matchName={`${selectedMatch.team1} vs ${selectedMatch.team2}`}
          onClose={handleClosePlayer}
        />
      )}
    </div>
  );
};

export default Index;
