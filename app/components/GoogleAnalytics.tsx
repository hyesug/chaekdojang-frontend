"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

const PRODUCTION_HOSTS = new Set(["www.chaekdojang.com", "chaekdojang.com"]);

function isProductionHost() {
  if (typeof window === "undefined") return false;
  return PRODUCTION_HOSTS.has(window.location.hostname);
}

function isExcludedPath(pathname: string) {
  return pathname.startsWith("/admin");
}

export default function GoogleAnalytics() {
  const pathname = usePathname();
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const shouldTrack = !!measurementId && isProductionHost() && !isExcludedPath(pathname);

  useEffect(() => {
    if (!shouldTrack) return;
    window.gtag?.("config", measurementId, {
      page_path: pathname,
      anonymize_ip: true,
    });
  }, [measurementId, pathname, shouldTrack]);

  if (!shouldTrack) {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${measurementId}', {
            page_path: window.location.pathname,
            anonymize_ip: true
          });
        `}
      </Script>
    </>
  );
}
