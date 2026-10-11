"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { API_BASE } from "../lib/api";
import { authFetch, isAuthenticated } from "../lib/auth";

export default function AdminNavLink({ onClick }: { onClick?: () => void }) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // sessionStorage 로그인 표시는 새 탭·새로고침 직후 비어 있을 수 있으므로
    // 서버 세션을 직접 확인한 뒤 역할을 조회한다.
    const check = async () => {
      try {
        if (!(await isAuthenticated())) { setIsAdmin(false); return; }

        const res = await authFetch(`${API_BASE}/api/users/me`, {
          headers: { Authorization: "Bearer cookie-session" },
        });
        if (!res.ok) {
          setIsAdmin(false);
          return;
        }
        const json = await res.json();
        const role = json.data?.role ?? json.role;
        setIsAdmin(role === "ADMIN" || role === "SUPER_ADMIN");
      } catch {
        setIsAdmin(false);
      }
    };

    check();
    window.addEventListener("auth-change", check);
    return () => window.removeEventListener("auth-change", check);
  }, []);

  if (!isAdmin) return null;

  return (
    <Link
      href="/admin"
      onClick={onClick}
      className="text-sm font-medium text-wine-700 underline decoration-wine-500/50 underline-offset-4 transition-colors hover:text-wine-500 whitespace-nowrap"
    >
      관리자
    </Link>
  );
}
