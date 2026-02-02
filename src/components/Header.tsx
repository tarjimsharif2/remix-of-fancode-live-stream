import { Tv } from "lucide-react";

export const Header = () => {
  return (
    <header className="gradient-header py-6 md:py-8 px-4">
      <div className="container mx-auto">
        <div className="flex items-center justify-center gap-3">
          <Tv className="w-8 h-8 md:w-10 md:h-10 text-foreground" />
          <h1 className="text-2xl md:text-4xl font-extrabold text-foreground tracking-tight">
            Live & Upcoming Matches
          </h1>
        </div>
      </div>
    </header>
  );
};
