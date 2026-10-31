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

// GA4 이벤트를 보낸다. GA 가 켜진 운영 주소에서만 window.gtag 가 있어 실제로 전송된다.
export function sendGaEvent(name: string, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  window.gtag?.("event", name, params);
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
