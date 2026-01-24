import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLocation } from "react-router-dom";

interface ReferrerCheckResult {
  isAllowed: boolean;
  isLoading: boolean;
  referrer: string | null;
}

// Check if running inside an iframe from allowed domain
const checkIframeAccess = async (allowedDomains: string[]): Promise<{ isAllowed: boolean; reason: string }> => {
  // Always allow dev/preview domains FIRST - before iframe check
  const hostname = window.location.hostname;
  const isDev = hostname === 'localhost' || 
    hostname === '127.0.0.1' ||
    hostname.includes('lovableproject.com') ||
    hostname.includes('lovable.app') ||
    hostname.includes('vercel.app');

  if (isDev) {
    return { isAllowed: true, reason: '' };
  }

  // Allow direct access from self-origin (if current hostname is in allowed domains)
  const isSelfAllowed = allowedDomains.some(domain => 
    hostname === domain || hostname.endsWith('.' + domain)
  );
  if (isSelfAllowed) {
    return { isAllowed: true, reason: '' };
  }

  const isInIframe = window.self !== window.top;
  
  if (!isInIframe) {
    return { isAllowed: false, reason: 'This content can only be accessed via embed.' };
  }

  try {
    const parentOrigin = document.referrer;
    
    if (!parentOrigin) {
      return { isAllowed: false, reason: 'Unable to verify parent origin.' };
    }

    const parentUrl = new URL(parentOrigin);
    const parentHostname = parentUrl.hostname;

    const isAllowedDomain = allowedDomains.some(domain => 
      parentHostname === domain || parentHostname.endsWith('.' + domain)
    );

    if (!isAllowedDomain) {
      return { isAllowed: false, reason: 'Embedding not authorized for this domain.' };
    }

    return { isAllowed: true, reason: '' };
  } catch {
    // Cross-origin error - check referrer as fallback
    const referrer = document.referrer;
    if (referrer) {
      try {
        const refUrl = new URL(referrer);
        const isAllowed = allowedDomains.some(domain => 
          refUrl.hostname === domain || refUrl.hostname.endsWith('.' + domain)
        );
        if (isAllowed) {
          return { isAllowed: true, reason: '' };
        }
      } catch {
        // Invalid referrer URL
      }
    }
    return { isAllowed: false, reason: 'Unable to verify embed origin.' };
  }
};

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

      // Check if admin is logged in - they get full access
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsAllowed(true);
        setIsLoading(false);
        return;
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

      // ===== Check Embed Access =====
      // Fetch embed_access_enabled setting
      const { data: embedSetting } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "embed_access_enabled")
        .single();

      const embedAccessEnabled = embedSetting?.value === 'true';

      if (embedAccessEnabled) {
        // Embed access is ON - must be accessed via iframe from allowed embed domains
        try {
          const { data, error: fnError } = await supabase.functions.invoke('get-allowed-domains');
          
          if (fnError) {
            console.error('Failed to fetch allowed domains:', fnError);
            setIsAllowed(false);
            setIsLoading(false);
            return;
          }
          
          const domains = data?.domains || [];
          const access = await checkIframeAccess(domains);
          
          if (!access.isAllowed) {
            console.log('Embed access denied:', access.reason);
            setIsAllowed(false);
            setIsLoading(false);
            return;
          }
          
          // Passed embed check, now continue to referrer check
        } catch (err) {
          console.error('Error checking embed access:', err);
          setIsAllowed(false);
          setIsLoading(false);
          return;
        }
      }

      // ===== Referrer Check =====
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

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setIsAllowed(true);
      }
    });

    return () => subscription.unsubscribe();
  }, [location.pathname]);

  return { isAllowed, isLoading, referrer };
};
