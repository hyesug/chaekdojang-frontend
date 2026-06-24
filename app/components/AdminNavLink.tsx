"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { API_BASE } from "../lib/api";

export default function AdminNavLink({ onClick }: { onClick?: () => void }) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const check = () => {
      const token: string | null = "cookie-session";
      if (!token || token === "undefined" || token === "null") { setIsAdmin(false); return; }

      fetch(`${API_BASE}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((j) => {
          const role = j.data?.role ?? j.role;
          setIsAdmin(role === "ADMIN" || role === "SUPER_ADMIN");
        })
        .catch(() => {});
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
      className="text-sm text-red-500 hover:text-red-700 transition-colors font-medium whitespace-nowrap"
    >
      관리자
    </Link>
  );
}
