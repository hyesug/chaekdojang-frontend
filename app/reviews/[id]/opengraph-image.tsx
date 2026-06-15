import { ImageResponse } from "next/og";
import {
  fetchApiData,
  reviewDescription,
  reviewTitle,
  shareText,
  type ReviewDetail,
} from "../../lib/serverApi";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function Image({ params }: Props) {
  const { id } = await params;
  const review = await fetchApiData<ReviewDetail>(`/api/reviews/${id}`, {
    next: { revalidate: 300 },
  });

  const title = review ? reviewTitle(review) : "책도장";
  const description = review ? reviewDescription(review) : shareText();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#FAF6EF",
          color: "#2A1810",
          padding: 64,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: 64,
            top: 58,
            width: 150,
            height: 150,
            border: "12px solid #8B1E1E",
            borderRadius: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#8B1E1E",
            fontSize: 28,
            fontWeight: 800,
            transform: "rotate(-10deg)",
          }}
        >
          책도장
        </div>
        <div style={{ display: "flex", flexDirection: "column", width: 790 }}>
          <div style={{ fontSize: 30, color: "#8B6048", marginBottom: 26 }}>
            {shareText()}
          </div>
          <div style={{ fontSize: 58, lineHeight: 1.16, fontWeight: 800 }}>
            {title}
          </div>
          <div
            style={{
              marginTop: 32,
              fontSize: 30,
              lineHeight: 1.45,
              color: "#6E4A36",
              maxHeight: 178,
              overflow: "hidden",
            }}
          >
            {description}
          </div>
          <div style={{ marginTop: "auto", display: "flex", gap: 16, alignItems: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: 999, background: "#8B6048" }} />
            <div style={{ fontSize: 26, color: "#6E4A36" }}>
              {review?.author.nickname ?? "책도장"}
            </div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
