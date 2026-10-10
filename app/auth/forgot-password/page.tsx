"use client";

import { useState } from "react";
import Link from "next/link";
import { API_BASE } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Field, Input } from "../../components/ui/Field";

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
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
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
    <div className="cdj-page flex min-h-[calc(100vh-8rem)] items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="cdj-kicker">Account recovery</p>
          <h1 className="cdj-title mt-3 text-3xl">비밀번호 찾기</h1>
          <p className="text-sm text-brown-400">
            가입 시 사용한 이메일을 입력하시면<br />비밀번호 재설정 링크를 보내드립니다
          </p>
        </div>

        {sent ? (
          <div className="cdj-surface p-6 text-center">
            <p className="text-brown-700 font-medium mb-1">이메일을 발송했습니다</p>
            <p className="text-sm text-brown-400 mb-6">
              <span className="text-brown-600 font-medium">{email}</span>의<br />
              받은 편지함을 확인해주세요
            </p>
            <Link
              href="/auth/login"
              className="cdj-button cdj-button--text mt-2"
            >
              로그인으로 돌아가기
            </Link>
          </div>
        ) : (
          <>
            <form
              onSubmit={handleSubmit}
              className="cdj-surface p-6"
            >
              <div className="flex flex-col gap-4">
                <Field label="이메일" error={error}>
                  {({ id, ...aria }) => <Input
                    id={id}
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="가입 시 사용한 이메일"
                    {...aria}
                  />}
                </Field>

                <Button
                  type="submit"
                  disabled={loading}
                  className="mt-1 w-full"
                >
                  {loading ? "발송 중..." : "재설정 링크 받기"}
                </Button>
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
