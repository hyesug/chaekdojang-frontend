export type PurchaseLinkItem = {
  provider: "COUPANG" | "KYOBO";
  label: string;
  url: string;
};

// 나중에 제휴 링크로 교체할 때 이 파일 한 곳만 수정하면 됩니다.
export function buildSearchLinks(title: string): PurchaseLinkItem[] {
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
