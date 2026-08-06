import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  COPY_GROUP_INVITE_SOURCE,
  GROUP_INVITE_SOURCE_PARAM,
  KAKAO_GROUP_INVITE_SOURCE,
} from "../../../lib/inviteTracking";

export const metadata: Metadata = {
  title: "독서모임 초대 - 책도장",
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function GroupInvitePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const query = await searchParams;
  const rawSource = query[GROUP_INVITE_SOURCE_PARAM];
  const source = Array.isArray(rawSource) ? rawSource[0] : rawSource;
  const targetParams = new URLSearchParams();
  if (source === KAKAO_GROUP_INVITE_SOURCE || source === COPY_GROUP_INVITE_SOURCE) {
    targetParams.set(GROUP_INVITE_SOURCE_PARAM, source);
  }
  const suffix = targetParams.size > 0 ? `?${targetParams.toString()}` : "";
  redirect(`/groups/${encodeURIComponent(slug)}${suffix}`);
}
