import Link from "next/link";
import PostCard, { type Post } from "./components/PostCard";

/* 백엔드 연결 전 보여줄 샘플 데이터 */
const MOCK_POSTS: Post[] = [
  {
    id: 1,
    user: { name: "이서연" },
    book: { title: "채식주의자", author: "한강" },
    rating: 5,
    content:
      "한강 작가의 문장은 언제나 나를 멈추게 한다. 이 책을 읽고 나서 한동안 아무 말도 하지 못했다. 채식을 선택한 영혜의 이야기지만, 결국 이것은 자유에 대한 이야기이고, 폭력에 대한 이야기다. 읽는 내내 불편했지만 그 불편함이 문학이 할 수 있는 가장 정직한 일이라고 생각했다.",
    createdAt: "2026-05-03",
    likeCount: 42,
    commentCount: 7,
  },
  {
    id: 2,
    user: { name: "김민준" },
    book: { title: "아몬드", author: "손원평" },
    rating: 4,
    content:
      "감정을 느끼지 못하는 소년 윤재의 이야기. 처음에는 낯설고 어색했지만, 읽어나갈수록 이 소년이 배워가는 '감정'이 내게도 전해지는 느낌이었다. 작가가 말하는 공감의 본질에 대해 오래 생각하게 되는 책이다.",
    createdAt: "2026-04-28",
    likeCount: 28,
    commentCount: 3,
  },
  {
    id: 3,
    user: { name: "박지유" },
    book: { title: "달러구트 꿈 백화점", author: "이미예" },
    rating: 4,
    content:
      "꿈을 파는 백화점이라는 아이디어가 정말 신선하다. 각 에피소드마다 따뜻한 이야기가 담겨 있어서 지친 하루 끝에 읽기 딱 좋은 책이었다. 두 번째 권도 금방 읽었을 만큼 매력적인 세계관.",
    createdAt: "2026-04-20",
    likeCount: 61,
    commentCount: 12,
  },
  {
    id: 4,
    user: { name: "최우진" },
    book: { title: "불편한 편의점", author: "김호연" },
    rating: 5,
    content:
      "편의점이라는 공간이 이토록 따뜻한 이야기를 품을 수 있다는 게 놀라웠다. 독고 씨를 통해 만나는 다양한 사람들의 이야기가 결국은 나 자신의 이야기처럼 느껴졌다. 마지막 장을 덮을 때 눈물이 났다.",
    createdAt: "2026-04-15",
    likeCount: 89,
    commentCount: 19,
  },
  {
    id: 5,
    user: { name: "정하은" },
    book: { title: "82년생 김지영", author: "조남주" },
    rating: 5,
    content:
      "처음에는 소설인지 사회보고서인지 모를 만큼 현실적이었다. 김지영 씨의 이야기가 내 이야기, 우리 엄마의 이야기, 주변 모든 여성의 이야기처럼 느껴졌다. 많은 사람이 읽었으면 한다.",
    createdAt: "2026-04-10",
    likeCount: 74,
    commentCount: 22,
  },
];

async function getPosts(): Promise<Post[]> {
  try {
    const res = await fetch("http://localhost:8080/api/posts", {
      next: { revalidate: 60 },
    });
    if (!res.ok) return MOCK_POSTS;
    return res.json();
  } catch {
    /* 백엔드 미실행 시 샘플 데이터 표시 */
    return MOCK_POSTS;
  }
}

export default async function FeedPage() {
  const posts = await getPosts();

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* 피드 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-bold text-brown-800">피드</h1>
          <p className="text-xs text-brown-400 mt-0.5">이웃의 독후감</p>
        </div>
        <Link
          href="/write"
          className="px-4 py-2 text-sm bg-brown-600 text-white rounded-full hover:bg-brown-700 transition-colors"
        >
          + 독후감 쓰기
        </Link>
      </div>

      {/* 독후감 목록 */}
      {posts.length > 0 ? (
        <div className="flex flex-col gap-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <div className="text-center py-24 text-brown-400">
          <p className="text-5xl mb-4">📖</p>
          <p className="font-medium">아직 독후감이 없어요</p>
          <p className="text-sm mt-2">첫 독후감을 작성해보세요!</p>
        </div>
      )}
    </div>
  );
}
