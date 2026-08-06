export const GROUP_INVITE_SOURCE_PARAM = "invite_source";
export const KAKAO_GROUP_INVITE_SOURCE = "kakao_reading_group";
export const COPY_GROUP_INVITE_SOURCE = "reading_group_link";

export const KAKAO_GROUP_INVITE_REFERRER = "chaekdojang://invite/kakao-reading-group";
export const COPY_GROUP_INVITE_REFERRER = "chaekdojang://invite/reading-group-link";

export type GroupInviteSource =
  | typeof KAKAO_GROUP_INVITE_SOURCE
  | typeof COPY_GROUP_INVITE_SOURCE;

export function groupInviteTracking(pathname: string, search: string) {
  if (!pathname.startsWith("/groups/")) return null;
  const source = new URLSearchParams(search).get(GROUP_INVITE_SOURCE_PARAM);
  if (source === KAKAO_GROUP_INVITE_SOURCE) {
    return { source, referrer: KAKAO_GROUP_INVITE_REFERRER };
  }
  if (source === COPY_GROUP_INVITE_SOURCE) {
    return { source, referrer: COPY_GROUP_INVITE_REFERRER };
  }
  return null;
}
