import { Header } from "@/components/Header";
import { MatchGrid } from "@/components/MatchGrid";
import { Footer } from "@/components/Footer";
import { matches } from "@/data/matches";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <MatchGrid matches={matches} />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
