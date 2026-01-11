import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLocation } from "react-router-dom";

interface ReferrerCheckResult {
  isAllowed: boolean;
  isLoading: boolean;
  referrer: string | null;
}

export const useReferrerCheck = (): ReferrerCheckResult => {
  const [isAllowed, setIsAllowed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [referrer, setReferrer] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    const checkReferrer = async () => {
      // Bypass for admin routes
      if (location.pathname.startsWith("/admin")) {
        setIsAllowed(true);
        setIsLoading(false);
        return;
      }

      // Get referrer from document
      const docReferrer = document.referrer;
      setReferrer(docReferrer);

      // If no referrer, check if we're in development or have stored access
      if (!docReferrer) {
        // Check localStorage for previously validated access
        const storedAccess = localStorage.getItem("referrer_validated");
        if (storedAccess) {
          const { timestamp, allowed } = JSON.parse(storedAccess);
          // Valid for 24 hours
          if (Date.now() - timestamp < 24 * 60 * 60 * 1000 && allowed) {
            setIsAllowed(true);
            setIsLoading(false);
            return;
          }
        }

        // Allow localhost/dev environments
        const hostname = window.location.hostname;
        if (
          hostname === "localhost" ||
          hostname === "127.0.0.1" ||
          hostname.includes("lovableproject.com") ||
          hostname.includes("lovable.app")
        ) {
          setIsAllowed(true);
          setIsLoading(false);
          return;
        }

        setIsAllowed(false);
        setIsLoading(false);
        return;
      }

      try {
        // Extract hostname from referrer
        const referrerUrl = new URL(docReferrer);
        const referrerHostname = referrerUrl.hostname;

        // Fetch allowed referrer domains
        const { data, error } = await supabase
          .from("referrer_domains")
          .select("domain")
          .eq("is_active", true);

        if (error) {
          console.error("Error fetching referrer domains:", error);
          setIsAllowed(false);
          setIsLoading(false);
          return;
        }

        const allowedDomains = data?.map((d) => d.domain) || [];

        // Check if referrer matches any allowed domain
        const isValid = allowedDomains.some(
          (domain) =>
            referrerHostname === domain ||
            referrerHostname.endsWith("." + domain)
        );

        if (isValid) {
          // Store valid access
          localStorage.setItem(
            "referrer_validated",
            JSON.stringify({ timestamp: Date.now(), allowed: true })
          );
        }

        setIsAllowed(isValid);
      } catch (err) {
        console.error("Error checking referrer:", err);
        setIsAllowed(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkReferrer();
  }, [location.pathname]);

  return { isAllowed, isLoading, referrer };
};
