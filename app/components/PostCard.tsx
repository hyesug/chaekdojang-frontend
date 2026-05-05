export type Post = {
  id: number;
  user: { name: string };
  book: { title: string; author: string };
  rating: number;
  content: string;
  createdAt: string;
  likeCount: number;
  commentCount: number;
};

/* 책 표지 색상 — 실제 표지 이미지가 없을 때 사용하는 컬러 팔레트 */
const COVER_COLORS = [
  "#8B6048", "#6E7A4A", "#4A6E7A", "#7A4A6E", "#6E4A7A", "#4A7A6E",
];

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-sm">
      <span className="text-amber-500">{"★".repeat(rating)}</span>
      <span className="text-cream-300">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

export default function PostCard({ post }: { post: Post }) {
  const coverColor = COVER_COLORS[post.id % COVER_COLORS.length];

  return (
    <article className="bg-white rounded-2xl border border-cream-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex gap-4">
        {/* 책 표지 — 실제 이미지 없이 색상 블록으로 표현 */}
        <div
          className="flex-shrink-0 w-11 h-16 rounded shadow-sm flex items-end justify-center pb-1 text-white/70 text-xs font-bold"
          style={{ backgroundColor: coverColor }}
          aria-hidden
        >
          {post.book.title[0]}
        </div>

        <div className="flex-1 min-w-0">
          {/* 작성자 + 날짜 */}
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-brown-400 font-medium">{post.user.name}</span>
            <time className="text-xs text-brown-300" dateTime={post.createdAt}>
              {post.createdAt.slice(0, 7).replace("-", ".")}
            </time>
          </div>

          {/* 책 정보 */}
          <p className="font-serif text-base font-bold text-brown-800 leading-snug">
            {post.book.title}
          </p>
          <p className="text-xs text-brown-400 mb-1">{post.book.author}</p>
          <Stars rating={post.rating} />
        </div>
      </div>

      {/* 독후감 본문 — 3줄까지만 표시 */}
      <p className="mt-3 text-sm text-brown-600 leading-relaxed line-clamp-3">
        {post.content}
      </p>

      {/* 좋아요·댓글 수 */}
      <div className="mt-3 flex gap-4 text-xs text-brown-400">
        <span>♥ {post.likeCount}</span>
        <span>💬 {post.commentCount}</span>
      </div>
    </article>
  );
}
