"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { API_BASE } from "../lib/api";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Field, Input, Textarea } from "../components/ui/Field";

interface InquirySummary {
  id: number;
  title: string;
  authorName: string;
  createdAt: string;
}

export default function CustomerSupportPage() {
  const [tab, setTab] = useState<"write" | "list">("write");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [myList, setMyList] = useState<InquirySummary[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const session: string | null = "cookie-session";
    setToken(session && session !== "undefined" && session !== "null" ? session : null);
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || !content.trim()) { setError("제목과 내용을 입력해주세요."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/api/inquiries`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title, content }),
      });
      if (res.ok) {
        setSuccess(true);
        setTitle(""); setContent("");
      } else {
        const body = await res.json().catch(() => null);
        const message = body?.message ?? body?.error ?? null;
        setError(message ? `오류: ${message} (${res.status})` : `오류가 발생했어요. (HTTP ${res.status})`);
      }
    } catch (caught) {
      setError(`네트워크 오류가 발생했어요. (${caught instanceof Error ? caught.message : "unknown"})`);
    } finally {
      setLoading(false);
    }
  }

  async function loadMyList() {
    if (!token) return;
    setListLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/inquiries/my`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const json = await res.json(); setMyList(json.data ?? []); }
    } finally {
      setListLoading(false);
    }
  }

  useEffect(() => { if (tab === "list" && token) loadMyList(); }, [tab, token]);

  if (token === null && typeof window !== "undefined") {
    return <main className="cdj-page max-w-2xl text-center"><p className="cdj-kicker">Customer support</p><h1 className="cdj-title mt-3 text-3xl">문의는 회원만 가능해요</h1><p className="mt-3 text-sm text-brown-400">로그인 후 문의를 남겨주세요.</p><Link href="/auth/login" className="cdj-button cdj-button--primary mt-6">로그인하기</Link></main>;
  }

  const titleError = error && !title.trim() ? error : undefined;
  const contentError = error && !content.trim() ? error : undefined;
  const requestError = error && title.trim() && content.trim() ? error : undefined;

  return (
    <main className="cdj-page max-w-2xl">
      <header className="mb-8"><p className="cdj-kicker">Customer support</p><h1 className="cdj-title mt-3 text-3xl">고객센터</h1><p className="mt-2 text-sm text-brown-400">문의사항이나 건의사항을 남겨주세요.</p></header>

      <div role="tablist" aria-label="고객센터 메뉴" className="mb-6 flex border-b border-cream-300">
        {(["write", "list"] as const).map((item) => <button key={item} type="button" role="tab" aria-selected={tab === item} aria-controls={`cs-${item}`} onClick={() => setTab(item)} className={`min-h-11 border-b-2 px-4 text-sm ${tab === item ? "border-brown-700 text-brown-800" : "border-transparent text-brown-400 hover:text-brown-600"}`}>{item === "write" ? "문의 작성" : "내 문의"}</button>)}
      </div>

      {tab === "write" && <section id="cs-write" role="tabpanel" className="cdj-surface p-5 sm:p-6">
        {success ? <div className="py-8 text-center"><p className="text-brown-800 font-medium">문의가 접수되었어요</p><p className="mt-1 text-sm text-brown-400">답변은 내 문의 탭에서 확인하실 수 있어요.</p><Button onClick={() => setSuccess(false)} className="mt-5">새 문의 작성</Button></div> : <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <Field label="제목" error={titleError}>{({ id, ...aria }) => <Input id={id} type="text" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="제목" {...aria} />}</Field>
          <Field label="문의 내용" hint="모든 문의는 비밀글로 처리됩니다." error={contentError}>{({ id, ...aria }) => <Textarea id={id} value={content} onChange={(event) => setContent(event.target.value)} placeholder="문의 내용을 입력해주세요" rows={6} {...aria} />}</Field>
          {requestError && <Alert tone="error">{requestError}</Alert>}
          <Button type="submit" disabled={loading} className="w-full">{loading ? "전송 중..." : "문의 보내기"}</Button>
        </form>}
      </section>}

      {tab === "list" && <section id="cs-list" role="tabpanel">
        {listLoading ? <p className="py-8 text-center text-sm text-brown-400">불러오는 중...</p> : myList.length === 0 ? <p className="py-8 text-center text-sm text-brown-400">문의 내역이 없어요.</p> : <div className="cdj-surface divide-y divide-cream-300">{myList.map((item) => <Link key={item.id} href={`/cs/${item.id}`} className="block px-4 py-4 transition-colors hover:bg-cream-100"><div className="flex items-center justify-between gap-4"><p className="text-sm font-medium text-brown-800">{item.title}</p><span className="text-xs text-brown-400">비밀글</span></div><p className="mt-1 text-xs text-brown-400">{new Date(item.createdAt).toLocaleDateString("ko-KR")}</p></Link>)}</div>}
      </section>}
    </main>
  );
}
