import { useReferrerCheck } from "@/hooks/useReferrerCheck";
import { AlertCircle, Shield } from "lucide-react";

interface ReferrerGuardProps {
  children: React.ReactNode;
}

export const ReferrerGuard = ({ children }: ReferrerGuardProps) => {
  const { isAllowed, isLoading } = useReferrerCheck();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!isAllowed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md text-center">
          <div className="w-20 h-20 mx-auto mb-6 bg-destructive/10 rounded-full flex items-center justify-center">
            <Shield className="w-10 h-10 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Access Denied
          </h1>
          <p className="text-muted-foreground mb-4">
            This content is only accessible from authorized partner websites.
          </p>
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="w-4 h-4" />
              <span>Please visit through an authorized referrer</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
