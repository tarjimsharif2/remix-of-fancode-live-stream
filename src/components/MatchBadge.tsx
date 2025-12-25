import { cn } from "@/lib/utils";

interface MatchBadgeProps {
  status: "live" | "upcoming";
}

export const MatchBadge = ({ status }: MatchBadgeProps) => {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-bold uppercase tracking-wider",
        status === "live"
          ? "bg-live text-foreground animate-pulse-live"
          : "bg-upcoming text-foreground"
      )}
    >
      {status === "live" && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-foreground opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-foreground"></span>
        </span>
      )}
      {status}
    </div>
  );
};
