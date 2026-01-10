import { useReferrerCheck } from "@/hooks/useReferrerCheck";
import { AlertCircle, ExternalLink } from "lucide-react";

interface ReferrerGateProps {
  children: React.ReactNode;
}

export const ReferrerGate = ({ children }: ReferrerGateProps) => {
  const { isAllowed, isChecking } = useReferrerCheck();

  if (isChecking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!isAllowed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 mx-auto bg-destructive/10 rounded-full flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
            <p className="text-muted-foreground">
              This site can only be accessed through authorized partner websites.
            </p>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
            <p className="flex items-center justify-center gap-2">
              <ExternalLink className="w-4 h-4" />
              Please visit through an authorized referrer
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
