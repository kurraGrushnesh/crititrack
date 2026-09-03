import { ImageResponse } from "next/og";

/**
 * The iOS home-screen icon. iOS wants a raster with a solid background
 * (no transparency, no rounding of our own — the OS masks it), so this
 * renders the CritiTrack gauge mark to a 180x180 PNG at build time.
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";
export const dynamic = "force-static";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1c7a53",
        }}
      >
        <div
          style={{
            width: 84,
            height: 84,
            borderRadius: "50%",
            border: "13px solid #f4f4f2",
            borderTopColor: "transparent",
            borderRightColor: "rgba(244,244,242,0.28)",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
