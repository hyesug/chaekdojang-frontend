export type PurchaseLinkItem = {
  provider: "COUPANG" | "KYOBO" | "NAVER_SERIES" | "KAKAO_PAGE" | "RIDI" | "MUNPIA";
  label: string;
  url: string;
};

// 나중에 제휴 링크로 교체할 때 이 파일 한 곳만 수정하면 됩니다.
export function buildSearchLinks(title: string, source?: string, sourceUrl?: string | null): PurchaseLinkItem[] {
  const platformLabels: Record<string, string> = {
    NAVER_SERIES: "네이버 시리즈에서 읽기",
    KAKAO_PAGE: "카카오페이지에서 읽기",
    RIDI: "리디에서 읽기",
    MUNPIA: "문피아에서 읽기",
  };
  if (source && sourceUrl && platformLabels[source]) {
    return [{
      provider: source as PurchaseLinkItem["provider"],
      label: platformLabels[source],
      url: sourceUrl,
    }];
  }
  const encoded = encodeURIComponent(title);
  return [
    {
      provider: "COUPANG",
      label: "쿠팡에서 보기",
      url: `https://www.coupang.com/np/search?q=${encoded}`,
    },
    {
      provider: "KYOBO",
      label: "교보문고에서 보기",
      url: `https://search.kyobobook.co.kr/search?keyword=${encoded}`,
    },
  ];
}
