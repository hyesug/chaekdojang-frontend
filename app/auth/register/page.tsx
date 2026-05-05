"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type FormState = {
  nickname: string;
  email: string;
  password: string;
  confirmPassword: string;
};

const FIELDS: { id: keyof FormState; label: string; type: string; placeholder: string }[] = [
  { id: "nickname", label: "닉네임", type: "text", placeholder: "책방지기" },
  { id: "email", label: "이메일", type: "email", placeholder: "example@email.com" },
  { id: "password", label: "비밀번호", type: "password", placeholder: "8자 이상 입력하세요" },
  { id: "confirmPassword", label: "비밀번호 확인", type: "password", placeholder: "비밀번호를 다시 입력하세요" },
];

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    nickname: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (form.password !== form.confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:8080/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: form.nickname,
          email: form.email,
          password: form.password,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { message?: string }).message ?? "회원가입에 실패했습니다.");
        return;
      }

      const json = await res.json();
      const token = json.data?.token ?? json.token;
      localStorage.setItem("token", token);
      window.dispatchEvent(new Event("auth-change"));
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
        {/* 회원가입 헤더 */}
        <div className="text-center mb-8">
          <h1 className="font-serif text-3xl font-bold text-brown-800 mb-2">회원가입</h1>
          <p className="text-sm text-brown-400">책인감과 함께 독서 여정을 시작하세요</p>
        </div>

        {/* 회원가입 폼 */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-cream-200 p-6 shadow-sm"
        >
          <div className="flex flex-col gap-4">
            {FIELDS.map(({ id, label, type, placeholder }) => (
              <div key={id}>
                <label className="block text-sm text-brown-600 mb-1.5" htmlFor={id}>
                  {label}
                </label>
                <input
                  id={id}
                  type={type}
                  required
                  value={form[id]}
                  onChange={update(id)}
                  placeholder={placeholder}
                  className="w-full px-4 py-2.5 rounded-xl border border-cream-300 text-sm text-brown-800 bg-cream-50 placeholder:text-brown-300 focus:outline-none focus:border-brown-400 focus:ring-2 focus:ring-brown-100 transition"
                />
              </div>
            ))}

            {error && (
              <p className="text-sm text-red-500 bg-red-50 px-4 py-2.5 rounded-xl">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-brown-600 text-white rounded-xl text-sm font-medium hover:bg-brown-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-1"
            >
              {loading ? "처리 중..." : "회원가입"}
            </button>
          </div>
        </form>

        <p className="text-center text-sm text-brown-400 mt-6">
          이미 계정이 있으신가요?{" "}
          <Link href="/auth/login" className="text-brown-600 font-medium hover:underline">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
