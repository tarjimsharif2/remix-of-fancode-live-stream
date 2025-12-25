import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { MatchGrid } from "@/components/MatchGrid";
import { Footer } from "@/components/Footer";
import { useMatches } from "@/hooks/useMatches";
import { Match } from "@/types/match";

const Index = () => {
  const { matches, loading, error, lastUpdated, refetch } = useMatches();
  const navigate = useNavigate();

  const handleWatch = (match: Match, region: 'BD' | 'IN') => {
    if (match.matchId) {
      const path = region === 'BD' ? '/fancode/play-bd.php' : '/fancode/play-in.php';
      navigate(`${path}?id=${match.matchId}`);
    }
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
    </div>
  );
};

export default Index;
