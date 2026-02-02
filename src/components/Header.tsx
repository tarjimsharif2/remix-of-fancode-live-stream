import { Tv, Youtube } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export const Header = () => {
  return (
    <header className="gradient-header py-6 md:py-8 px-4">
      <div className="container mx-auto">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <Tv className="w-8 h-8 md:w-10 md:h-10 text-foreground" />
            <h1 className="text-xl md:text-3xl font-extrabold text-foreground tracking-tight">
              Live Matches
            </h1>
          </Link>
          
          <Link to="/youtube">
            <Button variant="outline" size="sm" className="gap-2">
              <Youtube className="w-4 h-4 text-red-500" />
              <span className="hidden sm:inline">YouTube Live</span>
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
};
