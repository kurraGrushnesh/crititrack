import { ImageResponse } from "next/og";

/**
 * The social share card. A static PNG generated at build time (the site
 * is an export, so there is no runtime to render it on request). Plain
 * layout, the CritiTrack mark, the one-line claim — it has to read at
 * thumbnail size in a feed.
 */
export const alt =
  "CritiTrack — accountability tracking for public figures";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-static";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#f4f4f2",
          color: "#0b0b0a",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: 15,
              background: "#1c7a53",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                border: "5px solid #f4f4f2",
                borderTopColor: "transparent",
              }}
            />
          </div>
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.5 }}>
            CritiTrack
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 62,
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: -1.5,
            maxWidth: 900,
          }}
        >
          What have they actually been criticised for?
        </div>

        <div style={{ display: "flex", fontSize: 24, color: "#4c4c47" }}>
          Every serious claim typed, dated, severity-scored, and sourced.
        </div>
      </div>
    ),
    { ...size },
  );
}
