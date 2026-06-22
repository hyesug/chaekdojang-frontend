"use client";

import { useEffect, useState } from "react";

type Status = "checking" | "up" | "down" | "maintenance";

const CHECK_INTERVAL_MS = 15000;

export default function ServiceStatusGuard() {
  const maintenanceMode = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === "true";
  const [status, setStatus] = useState<Status>(
    maintenanceMode ? "maintenance" : "checking"
  );
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (maintenanceMode) return;

    let cancelled = false;

    async function checkHealth() {
      try {
        const res = await fetch("/system-health", {
          cache: "no-store",
        });
        if (cancelled) return;
        setStatus(res.ok ? "up" : "down");
      } catch {
        if (!cancelled) setStatus("down");
      } finally {
        if (!cancelled) setLastCheckedAt(new Date());
      }
    }

    checkHealth();
    const interval = window.setInterval(checkHealth, CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [maintenanceMode]);

  if (status === "checking" || status === "up") return null;

  const isMaintenance = status === "maintenance";
  const title = isMaintenance
    ? "책도장을 점검하고 있어요"
    : "책도장이 잠시 불안정해요";
  const description = isMaintenance
    ? "더 안정적인 서비스를 위해 잠시 정비 중입니다. 조금만 기다린 뒤 다시 접속해 주세요."
    : "서버 연결이 원활하지 않아 독후감과 내 서재 정보를 불러오지 못하고 있습니다. 복구되는 대로 다시 이용할 수 있어요.";

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-cream-100 px-5"
    >
      <section className="w-full max-w-md rounded-lg border border-cream-300 bg-white px-6 py-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border-2 border-brown-200 text-brown-600">
          <span className="font-serif text-2xl font-bold">책</span>
        </div>
        <h1 className="font-serif text-2xl font-bold text-brown-800">
          {title}
        </h1>
        <p className="mt-4 text-sm leading-6 text-brown-500">{description}</p>
        {!isMaintenance && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 rounded-full bg-brown-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brown-700"
          >
            다시 확인하기
          </button>
        )}
        {lastCheckedAt && !isMaintenance && (
          <p className="mt-4 text-xs text-brown-300">
            마지막 확인:{" "}
            {lastCheckedAt.toLocaleTimeString("ko-KR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}
      </section>
    </div>
  );
}
