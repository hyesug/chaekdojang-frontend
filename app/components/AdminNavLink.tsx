"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { API_BASE } from "../lib/api";
import { authFetch, getValidToken } from "../lib/auth";

export default function AdminNavLink({ onClick }: { onClick?: () => void }) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const check = async () => {
      const token = getValidToken();
      if (!token) { setIsAdmin(false); return; }

      const res = await authFetch(`${API_BASE}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setIsAdmin(false);
        return;
      }
      const json = await res.json();
      const role = json.data?.role ?? json.role;
      setIsAdmin(role === "ADMIN" || role === "SUPER_ADMIN");
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
