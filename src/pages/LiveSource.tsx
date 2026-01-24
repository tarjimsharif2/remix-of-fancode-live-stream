import { useParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { MatchGrid } from "@/components/MatchGrid";
import { Footer } from "@/components/Footer";
import { useJsonSourceMatches } from "@/hooks/useJsonSourceMatches";
import { Match } from "@/types/match";

const LiveSource = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { matches, loading, error, lastUpdated, sourceName, refetch } = useJsonSourceMatches(slug || "");

  const handleWatch = (match: Match, region: "BD" | "IN" | "WW") => {
    if (match.matchId) {
      if (region === "WW") {
        navigate(`/live/${slug}/play-ww?id=${match.matchId}`);
      } else {
        const path = region === "BD" ? "play-bd" : "play-in";
        navigate(`/live/${slug}/${path}?id=${match.matchId}`);
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="container mx-auto px-4 py-6">
          {sourceName && (
            <h1 className="text-2xl font-bold mb-6">{sourceName}</h1>
          )}
          <MatchGrid
            matches={matches}
            loading={loading}
            error={error}
            lastUpdated={lastUpdated ? lastUpdated.toLocaleString() : null}
            onWatch={handleWatch}
            onRefresh={refetch}
          />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default LiveSource;
