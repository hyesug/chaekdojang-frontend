"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ExpandableBio from "./ExpandableBio";
import ProfileAvatar from "./ProfileAvatar";
import { API_BASE } from "../lib/api";

const BASE = API_BASE;

type FollowUser = {
  id: number | null;
  nickname: string;
  profileImage: string | null;
  bio?: string | null;
};

type Props = {
  userId: number;
  type: "followers" | "followings";
  onClose: () => void;
};

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return "cookie-session";
}

function getMyUserId(): number | null {
  const token = getToken();
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
    );
    const raw = payload.userId ?? payload.id ?? payload.sub;
    return raw != null ? Number(raw) : null;
  } catch {
    return null;
  }
}

export default function FollowListModal({ userId, type, onClose }: Props) {
  const router = useRouter();
  const myId = getMyUserId();
  const isLoggedIn = !!getToken();

  const [users, setUsers] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);
  // 팔로우 상태: userId → following 여부
  // followings 목록이면 모두 팔로우 중, followers 목록이면 모두 미팔로우로 초기화
  const [followingMap, setFollowingMap] = useState<Record<number, boolean>>({});
  const [loadingMap, setLoadingMap] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const endpoint =
      type === "followings"
        ? `${BASE}/api/users/${userId}/followings`
        : `${BASE}/api/users/${userId}/followers`;

    const token = getToken();
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

    fetch(endpoint, { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json) {
          const list: FollowUser[] = json.data ?? json;
          setUsers(list);
          // 팔로잉 목록 → 전부 following=true / 팔로워 목록 → 전부 following=false
          const init: Record<number, boolean> = {};
          list.forEach((u) => {
            if (u.id !== null) init[u.id] = type === "followings";
          });
          setFollowingMap(init);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId, type]);

  async function handleFollow(targetId: number) {
    if (!isLoggedIn) {
      router.push("/auth/login");
      return;
    }
    const next = !followingMap[targetId];
    setFollowingMap((prev) => ({ ...prev, [targetId]: next }));
    setLoadingMap((prev) => ({ ...prev, [targetId]: true }));

    try {
      const res = await fetch(`${BASE}/api/users/${targetId}/follow`, {
        method: next ? "POST" : "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.status === 401) {
        setFollowingMap((prev) => ({ ...prev, [targetId]: !next }));
        
        router.push("/auth/login");
      } else if (!res.ok) {
        setFollowingMap((prev) => ({ ...prev, [targetId]: !next }));
      }
    } finally {
      setLoadingMap((prev) => ({ ...prev, [targetId]: false }));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative z-10 w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl max-h-[70vh] flex flex-col shadow-xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-cream-200">
          <h2 className="font-serif font-bold text-brown-800">
            {type === "followings" ? "팔로잉" : "팔로워"}
          </h2>
          <button
            onClick={onClose}
            className="text-brown-400 hover:text-brown-600 text-xl leading-none"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {/* 목록 */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-center text-brown-400 text-sm py-10">불러오는 중…</p>
          ) : users.length === 0 ? (
            <p className="text-center text-brown-400 text-sm py-10">
              {type === "followings" ? "팔로잉하는 사람이 없어요" : "팔로워가 없어요"}
            </p>
          ) : (
            <ul>
              {users.map((u) => {
                const canOpenProfile = u.id !== null;
                const targetId = u.id;
                const isMe = myId === u.id;
                const isFollowing = u.id !== null ? followingMap[u.id] ?? false : false;
                const isLoading = u.id !== null ? loadingMap[u.id] ?? false : false;

                return (
                  <li key={u.id ?? u.nickname} className="flex items-center gap-3 px-5 py-3.5 hover:bg-cream-50 transition-colors">
                    {/* 프로필 이미지 + 닉네임 → 프로필 페이지 링크 */}
                    <Link
                      href={isMe ? "/profile" : `/u/${encodeURIComponent(u.nickname)}`}
                      onClick={onClose}
                      aria-disabled={!canOpenProfile}
                      className={`flex items-center gap-3 flex-1 min-w-0 ${canOpenProfile ? "" : "pointer-events-none"}`}
                    >
                      <ProfileAvatar src={u.profileImage} name={u.nickname} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-brown-800 truncate">
                          {u.nickname}
                          {isMe && (
                            <span className="ml-1.5 text-xs text-brown-400 font-normal">(나)</span>
                          )}
                        </p>
                        <ExpandableBio bio={u.bio} compact className="mt-0.5" />
                      </div>
                    </Link>

                    {/* 팔로우/언팔로우 버튼 — 내 계정이 아니고 로그인된 경우에만 */}
                    {!isMe && isLoggedIn && targetId !== null && (
                      <button
                        onClick={() => handleFollow(targetId)}
                        disabled={isLoading}
                        className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors disabled:opacity-50 ${
                          isFollowing
                            ? "border-brown-300 text-brown-500 hover:border-red-300 hover:text-red-400"
                            : "border-brown-500 bg-brown-600 text-white hover:bg-brown-700"
                        }`}
                      >
                        {isFollowing ? "팔로잉" : "팔로우"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
