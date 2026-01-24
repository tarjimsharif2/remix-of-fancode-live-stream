import { MappedMatch } from "@/utils/jsonFieldMapper";
import { DynamicMatchCard } from "./DynamicMatchCard";
import { Skeleton } from "@/components/ui/skeleton";

interface DynamicMatchGridProps {
  matches: MappedMatch[];
  baseUrl: string;
  loading?: boolean;
  showRawData?: boolean;
}

export const DynamicMatchGrid = ({ 
  matches, 
  baseUrl, 
  loading = false,
  showRawData = false 
}: DynamicMatchGridProps) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="aspect-video w-full rounded-lg" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No matches found</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {matches.map((match) => (
        <DynamicMatchCard
          key={match.matchId}
          match={match}
          baseUrl={baseUrl}
          showRawData={showRawData}
        />
      ))}
    </div>
  );
};
