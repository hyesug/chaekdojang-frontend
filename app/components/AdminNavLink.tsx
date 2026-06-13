"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { API_BASE } from "../lib/api";

export default function AdminNavLink({ onClick }: { onClick?: () => void }) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token || token === "undefined" || token === "null") return;

    fetch(`${API_BASE}/api/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((j) => {
        const role = j.data?.role ?? j.role;
        if (role === "ADMIN" || role === "SUPER_ADMIN") setIsAdmin(true);
      })
      .catch(() => {});
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
