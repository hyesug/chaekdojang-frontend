"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "../lib/api";

const CONFIRM_TEXT = "계정 삭제";

export default function AccountDeletionActions() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    setLoggedIn(Boolean(token && token !== "undefined" && token !== "null"));
    setMounted(true);
  }, []);

  async function handleDelete() {
    const token = localStorage.getItem("token");
    if (!token || token === "undefined" || token === "null") {
      router.push("/auth/login");
      return;
    }

    if (confirmText.trim() !== CONFIRM_TEXT) {
      setError(`삭제하려면 '${CONFIRM_TEXT}'를 정확히 입력해 주세요.`);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/api/users/me`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem("token");
        window.dispatchEvent(new Event("auth-change"));
        router.push("/auth/login");
        return;
      }

      if (!res.ok) {
        setError("계정 삭제에 실패했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }

      localStorage.removeItem("token");
      window.dispatchEvent(new Event("auth-change"));
      router.replace("/?accountDeleted=true");
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  if (!mounted) {
    return (
      <div className="rounded-lg border border-cream-200 bg-white p-5">
        <p className="text-sm text-brown-400">계정 상태를 확인하는 중입니다.</p>
      </div>
    );
  }

  if (!loggedIn) {
    return (
      <div className="rounded-lg border border-cream-200 bg-white p-5">
        <h2 className="font-serif text-xl font-bold text-brown-800 mb-2">계정 삭제하기</h2>
        <p className="text-sm text-brown-500 leading-6 mb-4">
          계정을 삭제하려면 먼저 로그인해 주세요.
        </p>
        <Link
          href="/auth/login"
          className="inline-flex rounded-full bg-brown-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brown-700"
        >
          로그인하러 가기
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-red-100 bg-white p-5">
      <h2 className="font-serif text-xl font-bold text-red-700 mb-2">계정 삭제하기</h2>
      <p className="text-sm text-brown-500 leading-6">
        삭제를 진행하면 현재 계정으로 다시 로그인할 수 없습니다. 계속하려면 아래 입력칸에
        <span className="font-semibold text-red-700"> {CONFIRM_TEXT}</span>를 입력해 주세요.
      </p>

      <label className="mt-4 block">
        <span className="text-xs font-medium text-brown-500">확인 문구</span>
        <input
          value={confirmText}
          onChange={(e) => {
            setConfirmText(e.target.value);
            setError("");
          }}
          placeholder={CONFIRM_TEXT}
          className="mt-1 w-full rounded-xl border border-cream-300 bg-cream-50 px-4 py-3 text-sm text-brown-800 placeholder-brown-300 focus:border-red-300 focus:bg-white focus:outline-none"
        />
      </label>

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

      <button
        type="button"
        onClick={handleDelete}
        disabled={loading || confirmText.trim() !== CONFIRM_TEXT}
        className="mt-4 w-full rounded-xl bg-red-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? "삭제 처리 중..." : "계정 영구 삭제"}
      </button>
    </div>
  );
}
