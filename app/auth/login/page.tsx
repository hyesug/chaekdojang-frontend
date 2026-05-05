"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:8080/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { message?: string }).message ?? "이메일 또는 비밀번호를 확인해주세요.");
        return;
      }

      const json = await res.json();
      const token = json.data?.token ?? json.token;
      localStorage.setItem("token", token);
      router.push("/");
    } catch {
      setError("서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        {/* 로그인 헤더 */}
        <div className="text-center mb-8">
          <h1 className="font-serif text-3xl font-bold text-brown-800 mb-2">로그인</h1>
          <p className="text-sm text-brown-400">책인감에 오신 것을 환영합니다</p>
        </div>

        {/* 로그인 폼 */}
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
                placeholder="example@email.com"
                className="w-full px-4 py-2.5 rounded-xl border border-cream-300 text-sm text-brown-800 bg-cream-50 placeholder:text-brown-300 focus:outline-none focus:border-brown-400 focus:ring-2 focus:ring-brown-100 transition"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm text-brown-600" htmlFor="password">
                  비밀번호
                </label>
                <Link href="/auth/forgot-password" className="text-xs text-brown-400 hover:text-brown-600 hover:underline transition-colors">
                  비밀번호 찾기
                </Link>
              </div>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
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
              {loading ? "로그인 중..." : "로그인"}
            </button>
          </div>
        </form>

        <p className="text-center text-sm text-brown-400 mt-6">
          계정이 없으신가요?{" "}
          <Link href="/auth/register" className="text-brown-600 font-medium hover:underline">
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}
