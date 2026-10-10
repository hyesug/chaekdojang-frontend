"use client";

import { useEffect, useState } from "react";

type Status = "checking" | "up" | "down" | "maintenance";

const CHECK_INTERVAL_MS = 15000;

export default function ServiceStatusGuard() {
  const maintenanceMode = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === "true";
  const [status, setStatus] = useState<Status>(
    maintenanceMode ? "maintenance" : "checking"
  );

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

  // 서버 연결이 끊긴 것만으로는 화면 전체를 막지 않는다 — 메인 화면과 운세처럼 서버 없이도
  // 보이는 곳은 그대로 쓰게 두고, 위에 얇은 안내 띠만 띄운다. 화면을 막는 것은 점검 모드뿐이다.
  if (status === "down") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="sticky top-0 z-[100] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-brown-200 bg-cream-100 px-4 py-2 text-center text-xs text-brown-600"
      >
        <span>서버 연결이 원활하지 않아 독후감과 내 서재 정보를 잠시 불러오지 못하고 있어요.</span>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="font-semibold underline underline-offset-2"
        >
          다시 확인하기
        </button>
      </div>
    );
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-cream-100 px-5"
    >
      <section className="cdj-card w-full max-w-md px-6 py-8 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border-2 border-brown-200 text-brown-600">
          <span className="font-serif text-2xl font-bold">책</span>
        </div>
        <h1 className="cdj-title">책도장을 점검하고 있어요</h1>
        <p className="mt-4 text-sm leading-6 text-brown-500">
          더 안정적인 서비스를 위해 잠시 정비 중입니다. 조금만 기다린 뒤 다시 접속해 주세요.
        </p>
      </section>
    </div>
  );
}
