"use client";

import { useState } from "react";
import FollowListModal from "./FollowListModal";

type Props = {
  userId: number;
  reviewCount: number;
  followerCount: number;
  followingCount: number;
};

export default function PublicProfileStats({
  userId,
  reviewCount,
  followerCount,
  followingCount,
}: Props) {
  const [followModal, setFollowModal] = useState<null | "followers" | "followings">(null);

  return (
    <>
      <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-cream-200 bg-cream-50 p-2">
        <div className="rounded-xl bg-white px-3 py-2.5 text-center">
          <p className="text-lg font-bold leading-tight text-brown-800">{reviewCount}</p>
          <p className="mt-0.5 text-[11px] text-brown-400">독후감</p>
        </div>
        <button
          type="button"
          onClick={() => setFollowModal("followers")}
          className="group rounded-xl bg-white px-3 py-2.5 text-center transition-colors hover:bg-cream-100 focus:outline-none focus:ring-2 focus:ring-brown-200"
          aria-label="팔로워 목록 보기"
        >
          <p className="text-lg font-bold leading-tight text-brown-800">{followerCount}</p>
          <p className="mt-0.5 text-[11px] text-brown-500">팔로워</p>
        </button>
        <button
          type="button"
          onClick={() => setFollowModal("followings")}
          className="group rounded-xl bg-white px-3 py-2.5 text-center transition-colors hover:bg-cream-100 focus:outline-none focus:ring-2 focus:ring-brown-200"
          aria-label="팔로잉 목록 보기"
        >
          <p className="text-lg font-bold leading-tight text-brown-800">{followingCount}</p>
          <p className="mt-0.5 text-[11px] text-brown-500">팔로잉</p>
        </button>
      </div>

      {followModal && (
        <FollowListModal
          userId={userId}
          type={followModal}
          onClose={() => setFollowModal(null)}
        />
      )}
    </>
  );
}
