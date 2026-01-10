import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ReferrerCheckResult {
  isAllowed: boolean;
  isChecking: boolean;
  referrerDomain: string | null;
}

export const useReferrerCheck = () => {
  const [result, setResult] = useState<ReferrerCheckResult>({
    isAllowed: false,
    isChecking: true,
    referrerDomain: null,
  });

  useEffect(() => {
    const checkReferrer = async () => {
      try {
        // Get the referrer from document.referrer
        const referrer = document.referrer;
        
        // If no referrer, check localStorage for previously validated referrer
        const storedReferrer = localStorage.getItem("validated_referrer");
        const storedExpiry = localStorage.getItem("validated_referrer_expiry");
        
        // Check if stored referrer is still valid (24 hours)
        if (storedReferrer && storedExpiry) {
          const expiry = parseInt(storedExpiry, 10);
          if (Date.now() < expiry) {
            setResult({
              isAllowed: true,
              isChecking: false,
              referrerDomain: storedReferrer,
            });
            return;
          } else {
            // Clear expired referrer
            localStorage.removeItem("validated_referrer");
            localStorage.removeItem("validated_referrer_expiry");
          }
        }

        // If no referrer and no valid stored referrer, deny access
        if (!referrer) {
          setResult({
            isAllowed: false,
            isChecking: false,
            referrerDomain: null,
          });
          return;
        }

        // Extract domain from referrer
        let referrerDomain: string;
        try {
          const url = new URL(referrer);
          referrerDomain = url.hostname.replace(/^www\./, "");
        } catch {
          setResult({
            isAllowed: false,
            isChecking: false,
            referrerDomain: null,
          });
          return;
        }

        // Check if referrer domain is in the allowed list
        const { data, error } = await supabase
          .from("referrer_domains")
          .select("domain")
          .eq("is_active", true);

        if (error) {
          console.error("Error checking referrer domains:", error);
          setResult({
            isAllowed: false,
            isChecking: false,
            referrerDomain,
          });
          return;
        }

        const allowedDomains = data?.map((d) => d.domain) || [];
        
        // Check if referrer matches any allowed domain
        const isAllowed = allowedDomains.some((domain) => {
          // Exact match or subdomain match
          return (
            referrerDomain === domain ||
            referrerDomain.endsWith(`.${domain}`)
          );
        });

        if (isAllowed) {
          // Store validated referrer for 24 hours
          localStorage.setItem("validated_referrer", referrerDomain);
          localStorage.setItem(
            "validated_referrer_expiry",
            (Date.now() + 24 * 60 * 60 * 1000).toString()
          );
        }

        setResult({
          isAllowed,
          isChecking: false,
          referrerDomain,
        });
      } catch (err) {
        console.error("Error in referrer check:", err);
        setResult({
          isAllowed: false,
          isChecking: false,
          referrerDomain: null,
        });
      }
    };

    checkReferrer();
  }, []);

  return result;
};
