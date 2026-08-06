"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { API_BASE } from "../../../../lib/api";
import { authFetch } from "../../../../lib/auth";

type GroupBookStatus = "UPCOMING" | "READING" | "COMPLETED";

const STATUS_LABEL: Record<GroupBookStatus, string> = {
  UPCOMING: "다음 책",
  READING: "읽는 중",
  COMPLETED: "완독",
};

type Props = {
  slug: string;
  groupBookId: string;
  title: string;
  status: GroupBookStatus;
  deadline: string | null;
  note: string | null;
  initialManager: boolean;
};

export default function GroupBookManagePanel({ slug, groupBookId, title, status, deadline, note, initialManager }: Props) {
  const router = useRouter();
  const [canManage, setCanManage] = useState(initialManager);
  const [editing, setEditing] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    authFetch(`${API_BASE}/api/groups/${encodeURIComponent(slug)}`)
      .then(async (response) => {
        if (!response.ok) return;
        const json = await response.json();
        if (!cancelled) setCanManage(Boolean((json.data ?? json).manager));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [slug]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setWorking(true);
    setMessage("");
    try {
      const response = await authFetch(`${API_BASE}/api/groups/${encodeURIComponent(slug)}/books/${encodeURIComponent(groupBookId)}/progress`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: String(formData.get("status")),
          deadline: String(formData.get("deadline") ?? "") || null,
          note: String(formData.get("note") ?? "").trim() || null,
        }),
      });
      if (!response.ok) throw new Error();
      setEditing(false);
      setMessage("선정 책 정보를 저장했어요.");
      router.refresh();
    } catch {
      setMessage("선정 책 정보를 저장하지 못했어요.");
    } finally {
      setWorking(false);
    }
  }

  async function cancelSelection() {
    if (!window.confirm(`'${title}' 선정을 취소할까요?\n\n모임에 연결된 독후감과 질문·중간 생각은 모임에서 사라지지만, 독후감 원문은 삭제되지 않습니다.`)) return;
    setWorking(true);
    setMessage("");
    try {
      const response = await authFetch(`${API_BASE}/api/groups/${encodeURIComponent(slug)}/books/${encodeURIComponent(groupBookId)}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error();
      router.push(`/groups/${encodeURIComponent(slug)}`);
      router.refresh();
    } catch {
      setMessage("선정 책 취소를 처리하지 못했어요.");
      setWorking(false);
    }
  }

  if (!canManage) return null;

  return (
    <section className="mt-5 rounded-2xl border border-yellow-200 bg-yellow-50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-yellow-800">모임장 전용</p>
          <h2 className="mt-1 font-serif text-lg font-bold text-brown-900">선정 책 관리</h2>
        </div>
        {!editing && (
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing(true)} className="rounded-full border border-brown-300 bg-white px-4 py-2 text-sm font-semibold text-brown-700 hover:bg-cream-50">
              수정
            </button>
            <button type="button" disabled={working} onClick={cancelSelection} className="rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-500 hover:bg-red-50 disabled:opacity-40">
              선정 책 취소
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <form onSubmit={save} className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs text-brown-500">
              <span>진행 상태</span>
              <select name="status" defaultValue={status} className="w-full rounded-xl border border-yellow-200 bg-white px-3 py-2 text-sm text-brown-700 outline-none focus:border-brown-400">
                <option value="UPCOMING">다음 책</option>
                <option value="READING">읽는 중</option>
                <option value="COMPLETED">완독</option>
              </select>
            </label>
            <label className="space-y-1 text-xs text-brown-500">
              <span>마감일</span>
              <input name="deadline" type="date" defaultValue={deadline ?? ""} className="w-full rounded-xl border border-yellow-200 bg-white px-3 py-2 text-sm text-brown-700 outline-none focus:border-brown-400" />
            </label>
          </div>
          <label className="block space-y-1 text-xs text-brown-500">
            <span>회차/기간 메모</span>
            <input name="note" maxLength={200} defaultValue={note ?? ""} placeholder="예: 2회차 · 8월 1일~15일" className="w-full rounded-xl border border-yellow-200 bg-white px-3 py-2 text-sm text-brown-700 outline-none focus:border-brown-400" />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" disabled={working} onClick={() => setEditing(false)} className="rounded-full border border-cream-300 bg-white px-4 py-2 text-sm font-semibold text-brown-600 disabled:opacity-40">취소</button>
            <button disabled={working} className="rounded-full bg-brown-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">저장</button>
          </div>
        </form>
      ) : (
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="text-xs text-brown-400">진행 상태</dt><dd className="mt-1 font-medium text-brown-800">{STATUS_LABEL[status]}</dd></div>
          <div><dt className="text-xs text-brown-400">마감일</dt><dd className="mt-1 font-medium text-brown-800">{deadline ?? "미설정"}</dd></div>
          <div><dt className="text-xs text-brown-400">회차/기간 메모</dt><dd className="mt-1 font-medium text-brown-800">{note || "미설정"}</dd></div>
        </dl>
      )}

      {message && <p className="mt-3 text-sm text-brown-600">{message}</p>}
    </section>
  );
}
