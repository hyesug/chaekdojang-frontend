"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "../../../../lib/api";
import { authFetch } from "../../../../lib/auth";
import { formatDate, type EbookFile } from "../../../types";

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export default function EbookUploadPanel({ campaignId }: { campaignId: number }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<EbookFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await authFetch(`${API_BASE}/api/dojangdan/manage/campaigns/${campaignId}/ebook`);
    const json = await res.json().catch(() => null);
    setFile(json?.data ?? null);
  }, [campaignId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function upload(selected: File) {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", selected);
      // Content-Type은 브라우저가 boundary와 함께 넣도록 비워둔다.
      const res = await authFetch(
        `${API_BASE}/api/dojangdan/manage/campaigns/${campaignId}/ebook`,
        { method: "POST", body: form }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setError(json?.message ?? "파일을 올리지 못했습니다.");
        return;
      }
      setFile(json.data);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-brown-100 bg-white p-5 shadow-sm">
      <h2 className="font-serif text-lg font-bold text-brown-900">전자책 파일</h2>
      <p className="mt-1 text-xs leading-5 text-brown-400">
        PDF만 올릴 수 있고 50MB까지 지원합니다. 선정자에게는 열람자 정보(캠페인·독자 번호·발급 시각)가
        새겨진 파일이 따로 만들어져 전달됩니다.
      </p>

      {file ? (
        <div className="mt-4 rounded-xl bg-cream-50 px-4 py-3">
          <p className="truncate text-sm font-semibold text-brown-800">{file.originalFilename}</p>
          <p className="mt-0.5 text-xs text-brown-400">
            {formatBytes(file.byteSize)}
            {file.pageCount !== null && ` · ${file.pageCount}쪽`} · {formatDate(file.uploadedAt)} 업로드
          </p>
        </div>
      ) : (
        <p className="mt-4 rounded-xl bg-cream-50 px-4 py-3 text-sm text-brown-500">
          아직 올린 파일이 없습니다. 파일이 없으면 선정자가 책을 받을 수 없습니다.
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        onChange={(event) => {
          const selected = event.target.files?.[0];
          if (selected) void upload(selected);
        }}
        className="mt-4 block w-full text-sm text-brown-600 file:mr-3 file:rounded-full file:border-0 file:bg-brown-700 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brown-800"
      />

      {uploading && <p className="mt-2 text-sm text-brown-400">올리는 중…</p>}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {file && (
        <p className="mt-2 text-xs text-brown-400">
          새 파일을 올리면 기존 파일을 대체합니다. 이미 내려받은 파일은 회수할 수 없습니다.
        </p>
      )}
    </section>
  );
}
