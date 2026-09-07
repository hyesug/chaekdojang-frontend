"use client";

import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "../../lib/api";
import { authFetch } from "../../lib/auth";
import { formatDate, type MyEbookAccess } from "../types";

/**
 * 선정자에게 전자책을 내려주는 패널.
 * 파일 주소를 직접 노출하지 않고 서버를 거쳐 받으므로, 만료·회수가 즉시 반영된다.
 */
export default function EbookAccessPanel({
  applicationId,
  onDropped,
}: {
  applicationId: number;
  onDropped: () => Promise<void>;
}) {
  const [access, setAccess] = useState<MyEbookAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await authFetch(`${API_BASE}/api/dojangdan/applications/${applicationId}/ebook`);
    const json = await res.json().catch(() => null);
    setAccess(json?.data ?? null);
    setLoading(false);
  }, [applicationId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch(
        `${API_BASE}/api/dojangdan/applications/${applicationId}/ebook/download`
      );
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(json?.message ?? "파일을 받지 못했습니다.");
        await load();
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
      const fileName = encoded ? decodeURIComponent(encoded) : `chaekdojang-${applicationId}.pdf`;

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function dropOut() {
    if (!window.confirm("서평단을 포기하면 전자책 열람 권한이 바로 회수됩니다. 계속할까요?")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch(`${API_BASE}/api/dojangdan/applications/${applicationId}/drop`, {
        method: "POST",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setError(json?.message ?? "포기 처리에 실패했습니다.");
        return;
      }
      await onDropped();
    } finally {
      setBusy(false);
    }
  }

  if (loading || !access) return null;

  return (
    <div className="rounded-xl bg-cream-50 p-4">
      <p className="text-sm font-semibold text-brown-700">전자책</p>

      {access.revoked ? (
        <p className="mt-2 text-sm text-brown-500">열람 권한이 회수되었습니다.</p>
      ) : access.expired ? (
        <p className="mt-2 text-sm leading-6 text-brown-500">
          열람 기간이 {formatDate(access.expiresAt)}에 끝났습니다. 더 필요하시면 주최 측에 문의해
          주세요.
        </p>
      ) : (
        <>
          <p className="mt-1 text-xs text-brown-400">
            {formatDate(access.expiresAt)}까지 열람할 수 있습니다
            {access.pageCount !== null && ` · ${access.pageCount}쪽`} · 지금까지 {access.openCount}회
            받음
          </p>
          <button
            type="button"
            onClick={download}
            disabled={busy || !access.readable}
            className="mt-3 rounded-full bg-brown-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brown-800 disabled:opacity-60"
          >
            {busy ? "준비 중…" : "PDF 받기"}
          </button>
          {!access.readable && (
            <p className="mt-2 text-xs text-brown-400">
              아직 주최 측이 파일을 올리지 않았습니다.
            </p>
          )}
          <p className="mt-2 text-xs leading-5 text-brown-400">
            받으신 파일에는 열람자 정보가 새겨져 있습니다. 다른 곳에 공유하지 말아주세요.
          </p>
          <button
            type="button"
            onClick={dropOut}
            disabled={busy}
            className="mt-2 text-xs font-semibold text-red-600 underline disabled:opacity-60"
          >
            서평단 포기하기
          </button>
        </>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
