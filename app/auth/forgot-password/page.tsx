"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:8080/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { message?: string }).message ?? "이메일 발송에 실패했습니다. 다시 시도해주세요.");
        return;
      }

      setSent(true);
    } catch {
      setError("서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-serif text-3xl font-bold text-brown-800 mb-2">비밀번호 찾기</h1>
          <p className="text-sm text-brown-400">
            가입 시 사용한 이메일을 입력하시면<br />비밀번호 재설정 링크를 보내드립니다
          </p>
        </div>

        {sent ? (
          <div className="bg-white rounded-2xl border border-cream-200 p-6 shadow-sm text-center">
            <div className="text-4xl mb-4">📬</div>
            <p className="text-brown-700 font-medium mb-1">이메일을 발송했습니다</p>
            <p className="text-sm text-brown-400 mb-6">
              <span className="text-brown-600 font-medium">{email}</span>의<br />
              받은 편지함을 확인해주세요
            </p>
            <Link
              href="/auth/login"
              className="text-sm text-brown-600 font-medium hover:underline"
            >
              로그인으로 돌아가기
            </Link>
          </div>
        ) : (
          <>
            <form
              onSubmit={handleSubmit}
              className="bg-white rounded-2xl border border-cream-200 p-6 shadow-sm"
            >
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm text-brown-600 mb-1.5" htmlFor="email">
                    이메일
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="가입 시 사용한 이메일"
                    className="w-full px-4 py-2.5 rounded-xl border border-cream-300 text-sm text-brown-800 bg-cream-50 placeholder:text-brown-300 focus:outline-none focus:border-brown-400 focus:ring-2 focus:ring-brown-100 transition"
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-500 bg-red-50 px-4 py-2.5 rounded-xl">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-brown-600 text-white rounded-xl text-sm font-medium hover:bg-brown-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-1"
                >
                  {loading ? "발송 중..." : "재설정 링크 받기"}
                </button>
              </div>
            </form>

            <p className="text-center text-sm text-brown-400 mt-6">
              <Link href="/auth/login" className="text-brown-600 font-medium hover:underline">
                로그인으로 돌아가기
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
