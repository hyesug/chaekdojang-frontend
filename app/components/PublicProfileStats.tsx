"use client";

import { useState } from "react";
import FollowListModal from "./FollowListModal";

type Props = {
  userId: number;
  reviewCount: number;
  finishedCount: number;
  followerCount: number;
  followingCount: number;
};

export default function PublicProfileStats({
  userId,
  reviewCount,
  finishedCount,
  followerCount,
  followingCount,
}: Props) {
  const [followModal, setFollowModal] = useState<null | "followers" | "followings">(null);

  return (
    <>
      <div className="grid grid-cols-4 gap-2 mt-5">
        <div className="rounded-lg bg-cream-50 px-3 py-3 text-center border border-cream-200">
          <p className="text-xl font-bold text-brown-800">{reviewCount}</p>
          <p className="text-xs text-brown-400 mt-0.5">독후감</p>
        </div>
        <div className="rounded-lg bg-cream-50 px-3 py-3 text-center border border-cream-200">
          <p className="text-xl font-bold text-brown-800">{finishedCount}</p>
          <p className="text-xs text-brown-400 mt-0.5">완독</p>
        </div>
        <button
          type="button"
          onClick={() => setFollowModal("followers")}
          className="group rounded-lg border border-brown-200 bg-cream-50 px-3 py-3 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-brown-400 hover:bg-white hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brown-300 active:translate-y-0"
          aria-label="팔로워 목록 보기"
        >
          <p className="text-xl font-bold text-brown-800">{followerCount}</p>
          <p className="text-xs text-brown-500 mt-0.5">팔로워</p>
        </button>
        <button
          type="button"
          onClick={() => setFollowModal("followings")}
          className="group rounded-lg border border-brown-200 bg-cream-50 px-3 py-3 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-brown-400 hover:bg-white hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brown-300 active:translate-y-0"
          aria-label="팔로잉 목록 보기"
        >
          <p className="text-xl font-bold text-brown-800">{followingCount}</p>
          <p className="text-xs text-brown-500 mt-0.5">팔로잉</p>
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
