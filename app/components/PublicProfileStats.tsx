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
          className="rounded-lg bg-cream-50 px-3 py-3 text-center border border-cream-200 hover:bg-white transition-colors"
        >
          <p className="text-xl font-bold text-brown-800">{followerCount}</p>
          <p className="text-xs text-brown-400 mt-0.5">팔로워</p>
        </button>
        <button
          type="button"
          onClick={() => setFollowModal("followings")}
          className="rounded-lg bg-cream-50 px-3 py-3 text-center border border-cream-200 hover:bg-white transition-colors"
        >
          <p className="text-xl font-bold text-brown-800">{followingCount}</p>
          <p className="text-xs text-brown-400 mt-0.5">팔로잉</p>
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
