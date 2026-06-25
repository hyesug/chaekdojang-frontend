"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { API_BASE } from "../../lib/api";
import { authFetch, getValidToken } from "../../lib/auth";

type JoinPolicy = "OPEN" | "APPROVAL";
type MembershipStatus = "PENDING" | "APPROVED" | "REJECTED" | "BLOCKED" | null;

type GroupResponse = {
  member: boolean;
  memberCount: number;
  membershipStatus: MembershipStatus;
};

export default function GroupDetailClient({
  slug,
  initialMember,
  initialMemberCount,
  joinEnabled,
  joinPolicy,
  manager,
  initialMembershipStatus,
  showMemberCount = true,
}: {
  slug: string;
  initialMember: boolean;
  initialMemberCount: number;
  joinEnabled: boolean;
  joinPolicy: JoinPolicy;
  manager: boolean;
  initialMembershipStatus: MembershipStatus;
  showMemberCount?: boolean;
}) {
  const router = useRouter();
  const [member, setMember] = useState(initialMember);
  const [memberCount, setMemberCount] = useState(initialMemberCount);
  const [membershipStatus, setMembershipStatus] = useState<MembershipStatus>(initialMembershipStatus);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  function getToken() {
    return getValidToken();
  }

  async function joinGroup() {
    const token = getToken();
    if (!token) {
      router.push("/auth/login");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const res = await authFetch(`${API_BASE}/api/groups/${slug}/join`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      const group = (json.data ?? json) as GroupResponse;
      setMember(group.member);
      setMembershipStatus(group.membershipStatus);
      setMemberCount(group.memberCount ?? memberCount);
      setMessage(joinPolicy === "OPEN" ? "모임에 가입했어요." : "가입 요청을 보냈어요. 모임장 승인을 기다려주세요.");
      router.refresh();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "";
      setMessage(errorMessage.includes("차단") ? "이 모임에는 가입 신청할 수 없어요." : "가입 요청을 처리하지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }

  async function leaveGroup() {
    const token = getToken();
    if (!token) {
      router.push("/auth/login");
      return;
    }
    if (!window.confirm("이 모임에서 탈퇴할까요?")) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await authFetch(`${API_BASE}/api/groups/${slug}/leave`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      const group = (json.data ?? json) as GroupResponse;
      setMember(group.member);
      setMembershipStatus(group.membershipStatus);
      setMemberCount(group.memberCount ?? Math.max(0, memberCount - 1));
      setMessage("모임에서 탈퇴했어요.");
      router.refresh();
    } catch {
      setMessage("모임에서 탈퇴하지 못했어요. 모임장은 탈퇴할 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }

  if (membershipStatus === "PENDING") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-yellow-50 px-3 py-1 text-xs font-medium text-yellow-700">승인 대기 중</span>
        {showMemberCount && <span className="rounded-full bg-cream-100 px-3 py-1 text-xs text-brown-500">멤버 {memberCount}명</span>}
      </div>
    );
  }

  if (membershipStatus === "BLOCKED") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-600">가입 차단됨</span>
        {showMemberCount && <span className="rounded-full bg-cream-100 px-3 py-1 text-xs text-brown-500">멤버 {memberCount}명</span>}
      </div>
    );
  }

  if (member || manager) {
    return (
      <div className="flex flex-col items-start gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-600">
            {manager ? "모임장" : "참여 중"}
          </span>
          {showMemberCount && <span className="rounded-full bg-cream-100 px-3 py-1 text-xs text-brown-500">멤버 {memberCount}명</span>}
        </div>
        {!manager && (
          <button
            type="button"
            onClick={leaveGroup}
            disabled={loading}
            className="rounded-full border border-cream-300 px-4 py-2 text-sm font-semibold text-brown-600 hover:bg-cream-50 disabled:opacity-50"
          >
            {loading ? "처리 중..." : "모임 탈퇴하기"}
          </button>
        )}
        {message && <p className="text-xs text-brown-400">{message}</p>}
      </div>
    );
  }

  if (!joinEnabled) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <p className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-500">가입 중지</p>
        {showMemberCount && <span className="rounded-full bg-cream-100 px-3 py-1 text-xs text-brown-500">멤버 {memberCount}명</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      {showMemberCount && <span className="rounded-full bg-cream-100 px-3 py-1 text-xs text-brown-500">멤버 {memberCount}명</span>}
      <button
        onClick={joinGroup}
        disabled={loading}
        className="rounded-full bg-brown-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brown-800 disabled:opacity-50"
      >
        {loading ? "처리 중..." : joinPolicy === "APPROVAL" ? "가입 신청하기" : "모임 가입하기"}
      </button>
      {message && <p className="text-xs text-brown-400">{message}</p>}
    </div>
  );
}
